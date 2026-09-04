mergeInto(LibraryManager.library, {
  PrismBreak_LoadStorage: function (keyPointer) {
    try {
      var key = UTF8ToString(keyPointer);
      var value = window.localStorage.getItem(key);
      if (value === null || value === undefined) return 0;
      var bytes = lengthBytesUTF8(value) + 1;
      var result = _malloc(bytes);
      stringToUTF8(value, result, bytes);
      return result;
    } catch (error) {
      return 0;
    }
  },

  PrismBreak_FreeStorageString: function (pointer) {
    if (pointer) _free(pointer);
  },

  PrismBreak_SaveStorage: function (keyPointer, valuePointer) {
    try {
      window.localStorage.setItem(UTF8ToString(keyPointer), UTF8ToString(valuePointer));
    } catch (error) {}
  },

  PrismBreak_DeleteStorage: function (keyPointer) {
    try {
      window.localStorage.removeItem(UTF8ToString(keyPointer));
    } catch (error) {}
  }
});
