import visual01 from "./assets/ships/ship-01.png";
import visual02 from "./assets/ships/ship-02.png";
import visual03 from "./assets/ships/ship-03.png";
import visual04 from "./assets/ships/ship-04.png";
import visual05 from "./assets/ships/ship-05.png";
import visual06 from "./assets/ships/ship-06.png";
import visual07 from "./assets/ships/ship-07.png";
import visual08 from "./assets/ships/ship-08.png";
import visual09 from "./assets/ships/ship-09.png";
import visual10 from "./assets/ships/ship-10.png";
import visual11 from "./assets/ships/ship-11.png";
import visual12 from "./assets/ships/ship-12.png";
import visual13 from "./assets/ships/ship-13.png";
import visual14 from "./assets/ships/ship-14.png";
import visual15 from "./assets/ships/ship-15.png";
import visual16 from "./assets/ships/ship-16.png";
import visual17 from "./assets/ships/ship-17.png";
import visual18 from "./assets/ships/ship-18.png";
import visual19 from "./assets/ships/ship-19.png";
import visual20 from "./assets/ships/ship-20.png";
import visual21 from "./assets/ships/ship-21.png";
import visual22 from "./assets/ships/ship-22.png";
import visual23 from "./assets/ships/ship-23.png";
import visual24 from "./assets/ships/ship-24.png";
import visual25 from "./assets/ships/ship-25.png";
import visual26 from "./assets/ships/ship-26.png";
import visual27 from "./assets/ships/ship-27.png";
import visual28 from "./assets/ships/ship-28.png";
import visual29 from "./assets/ships/ship-29.png";
import visual30 from "./assets/ships/ship-30.png";

const assetUrl = (asset: string | { src: string }) => typeof asset === "string" ? asset : asset.src;

export const ENEMY_VISUALS = [
  visual01, visual02, visual03, visual04, visual05, visual06, visual07, visual08, visual09, visual10,
  visual11, visual12, visual13, visual14, visual15, visual16, visual17, visual18, visual19, visual20,
  visual21, visual22, visual23, visual24, visual25, visual26, visual27, visual28, visual29, visual30,
].map(assetUrl);
