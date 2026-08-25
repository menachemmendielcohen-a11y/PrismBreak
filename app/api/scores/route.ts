import { getChatGPTUser } from "../../../app/chatgpt-auth";
import { getD1 } from "../../../db";

export const dynamic = "force-dynamic";

const MODES = ["campaign", "daily", "arcade"] as const;
const DIFFICULTIES = ["cadet", "standard", "overdrive"] as const;
const MAX_BODY_BYTES = 8_192;
const MAX_SCORES_PER_PAGE = 50;

type ScoreMode = (typeof MODES)[number];
type Difficulty = (typeof DIFFICULTIES)[number];

interface ScoreRecord {
  id: number;
  callsign: string;
  score: number;
  mode: ScoreMode;
  stage: number;
  difficulty: Difficulty;
  kills: number;
  absorbed: number;
  comboX100: number;
  durationMs: number;
  completed: number;
  dailyKey: string;
  createdAt: string;
}

const SCORE_COLUMNS = `
  id,
  callsign,
  score,
  mode,
  stage,
  difficulty,
  kills,
  absorbed,
  combo_x100 AS comboX100,
  duration_ms AS durationMs,
  completed,
  daily_key AS dailyKey,
  updated_at AS createdAt
`;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const mode = readMode(params.get("mode") ?? "daily");
  const limit = readQueryInteger(
    params.get("limit"),
    20,
    1,
    MAX_SCORES_PER_PAGE,
  );

  if (!mode || limit === null) {
    return errorResponse("Invalid leaderboard filters.", 400);
  }

  try {
    const database = getD1();
    let statement: D1PreparedStatement;

    if (mode === "daily") {
      const dailyKey = params.get("date") ?? utcDateKey();
      if (!isDateKey(dailyKey)) {
        return errorResponse("date must use YYYY-MM-DD.", 400);
      }

      statement = database
        .prepare(
          `SELECT ${SCORE_COLUMNS}
           FROM scores
           WHERE mode = 'daily' AND stage = -1 AND difficulty = 'standard' AND daily_key = ?
           ORDER BY score DESC, updated_at DESC, id DESC
           LIMIT ?`,
        )
        .bind(dailyKey, limit);
    } else if (mode === "campaign") {
      const stage = readQueryInteger(params.get("stage"), 0, 0, 5);
      const difficulty = readDifficulty(params.get("difficulty") ?? "cadet");
      if (stage === null || !difficulty) {
        return errorResponse("Invalid campaign filters.", 400);
      }

      statement = database
        .prepare(
          `SELECT ${SCORE_COLUMNS}
           FROM scores
           WHERE mode = 'campaign' AND stage = ? AND difficulty = ? AND daily_key = ''
           ORDER BY score DESC, updated_at DESC, id DESC
           LIMIT ?`,
        )
        .bind(stage, difficulty, limit);
    } else {
      const difficulty = readDifficulty(params.get("difficulty") ?? "standard");
      if (!difficulty) {
        return errorResponse("Invalid arcade filters.", 400);
      }

      statement = database
        .prepare(
          `SELECT ${SCORE_COLUMNS}
           FROM scores
           WHERE mode = 'arcade' AND stage = -1 AND difficulty = ? AND daily_key = ''
           ORDER BY score DESC, updated_at DESC, id DESC
           LIMIT ?`,
        )
        .bind(difficulty, limit);
    }

    const { results } = await statement.all<ScoreRecord>();
    const scores = results.map((score, index) => ({
      ...score,
      completed: Boolean(score.completed),
      rank: index + 1,
    }));

    return Response.json(
      { scores },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Unable to read leaderboard", error);
    return errorResponse("Leaderboard temporarily unavailable.", 503);
  }
}

export async function POST(request: Request) {
  const sameOriginError = validateOrigin(request);
  if (sameOriginError) return sameOriginError;

  const user = await getChatGPTUser();
  if (!user) {
    return errorResponse("Sign in with ChatGPT to submit a score.", 401);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return errorResponse("Score payload is too large.", 413);
  }

  let payload: unknown;
  try {
    const body = await request.text();
    if (body.length > MAX_BODY_BYTES) {
      return errorResponse("Score payload is too large.", 413);
    }
    payload = JSON.parse(body);
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
  }

  const parsed = parseScoreSubmission(payload);
  if (!parsed.ok) return errorResponse(parsed.error, 400);

  const callsign = callsignFor(user.userId);
  const score = parsed.value;

  try {
    const saved = await getD1()
      .prepare(
        `INSERT INTO scores (
          user_id, callsign, score, mode, stage, difficulty, daily_key,
          kills, absorbed, combo_x100, duration_ms, completed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (user_id, mode, stage, difficulty, daily_key) DO UPDATE SET
          callsign = excluded.callsign,
          score = MAX(scores.score, excluded.score),
          kills = CASE WHEN excluded.score > scores.score THEN excluded.kills ELSE scores.kills END,
          absorbed = CASE WHEN excluded.score > scores.score THEN excluded.absorbed ELSE scores.absorbed END,
          combo_x100 = CASE WHEN excluded.score > scores.score THEN excluded.combo_x100 ELSE scores.combo_x100 END,
          duration_ms = CASE WHEN excluded.score > scores.score THEN excluded.duration_ms ELSE scores.duration_ms END,
          completed = CASE WHEN excluded.score > scores.score THEN excluded.completed ELSE scores.completed END,
          updated_at = CASE WHEN excluded.score > scores.score THEN CURRENT_TIMESTAMP ELSE scores.updated_at END
        RETURNING ${SCORE_COLUMNS}`,
      )
      .bind(
        user.userId,
        callsign,
        score.score,
        score.mode,
        score.stage,
        score.difficulty,
        score.dailyKey,
        score.kills,
        score.absorbed,
        score.comboX100,
        score.durationMs,
        score.completed ? 1 : 0,
      )
      .first<ScoreRecord>();

    if (!saved) {
      throw new Error("D1 did not return the saved score.");
    }

    const rankResult = await getD1()
      .prepare(
        `SELECT COUNT(*) AS ahead
         FROM scores
         WHERE mode = ? AND stage = ? AND difficulty = ? AND daily_key = ?
           AND (
             score > ?
             OR (score = ? AND updated_at > ?)
             OR (score = ? AND updated_at = ? AND id > ?)
           )`,
      )
      .bind(
        saved.mode,
        saved.stage,
        saved.difficulty,
        saved.dailyKey,
        saved.score,
        saved.score,
        saved.createdAt,
        saved.score,
        saved.createdAt,
        saved.id,
      )
      .first<{ ahead: number }>();

    return Response.json({
      score: { ...saved, completed: Boolean(saved.completed) },
      rank: Number(rankResult?.ahead ?? 0) + 1,
    });
  } catch (error) {
    console.error("Unable to save leaderboard score", error);
    return errorResponse("Score could not be saved.", 503);
  }
}

function parseScoreSubmission(
  value: unknown,
):
  | {
      ok: true;
      value: {
        score: number;
        mode: ScoreMode;
        stage: number;
        difficulty: Difficulty;
        dailyKey: string;
        kills: number;
        absorbed: number;
        comboX100: number;
        durationMs: number;
        completed: boolean;
      };
    }
  | { ok: false; error: string } {
  if (!isRecord(value)) {
    return { ok: false, error: "Score payload must be an object." };
  }

  const mode = readMode(value.mode);
  const score = readInteger(value.score, 1, 100_000_000);
  const kills = readOptionalInteger(value.kills, 0, 0, 100_000);
  const absorbed = readOptionalInteger(value.absorbed, 0, 0, 100_000);
  const comboX100 = readOptionalInteger(value.comboX100, 100, 100, 100_000);
  const durationMs = readOptionalInteger(
    value.durationMs,
    0,
    0,
    3_600_000,
  );
  const completed = value.completed ?? false;

  if (
    !mode ||
    score === null ||
    kills === null ||
    absorbed === null ||
    comboX100 === null ||
    durationMs === null ||
    typeof completed !== "boolean"
  ) {
    return { ok: false, error: "Score fields are invalid or out of range." };
  }

  let stage = -1;
  let difficulty: Difficulty;
  let dailyKey = "";

  if (mode === "campaign") {
    const campaignStage = readInteger(value.stage, 0, 5);
    const campaignDifficulty = readDifficulty(value.difficulty);
    if (campaignStage === null || !campaignDifficulty) {
      return { ok: false, error: "Campaign scores require a valid stage and difficulty." };
    }
    stage = campaignStage;
    difficulty = campaignDifficulty;
  } else if (mode === "daily") {
    if (value.difficulty !== undefined && value.difficulty !== "standard") {
      return { ok: false, error: "Daily scores use standard difficulty." };
    }
    dailyKey = typeof value.dailyKey === "string" ? value.dailyKey : utcDateKey();
    if (dailyKey !== utcDateKey()) {
      return { ok: false, error: "Only today's daily score can be submitted." };
    }
    difficulty = "standard";
  } else {
    const arcadeDifficulty = readDifficulty(value.difficulty);
    if (!arcadeDifficulty) {
      return { ok: false, error: "Arcade scores require a valid difficulty." };
    }
    difficulty = arcadeDifficulty;
  }

  return {
    ok: true,
    value: {
      score,
      mode,
      stage,
      difficulty,
      dailyKey,
      kills,
      absorbed,
      comboX100,
      durationMs,
      completed,
    },
  };
}

function validateOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return errorResponse("Cross-origin score submissions are not allowed.", 403);
  }
  return null;
}

function callsignFor(userId: string) {
  let hash = 2_166_136_261;
  for (const character of userId) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  const suffix = (hash >>> 0).toString(36).toUpperCase().padStart(6, "0").slice(-6);
  return `PILOT-${suffix}`;
}

function readMode(value: unknown): ScoreMode | null {
  return typeof value === "string" && MODES.includes(value as ScoreMode)
    ? (value as ScoreMode)
    : null;
}

function readDifficulty(value: unknown): Difficulty | null {
  return typeof value === "string" &&
    DIFFICULTIES.includes(value as Difficulty)
    ? (value as Difficulty)
    : null;
}

function readInteger(value: unknown, min: number, max: number) {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= min &&
    value <= max
    ? value
    : null;
}

function readOptionalInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) {
  return value === undefined ? fallback : readInteger(value, min, max);
}

function readQueryInteger(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
) {
  if (value === null) return fallback;
  if (!/^-?\d+$/.test(value)) return null;
  return readInteger(Number(value), min, max);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function utcDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function errorResponse(message: string, status: number) {
  return Response.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
