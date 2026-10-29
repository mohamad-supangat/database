export function isEmpty(value: null | string | [] | object) {
  if (value == null) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === "object" && Object.keys(value).length === 0) return true;
  if (value instanceof Map || value instanceof Set) return value.size === 0;
  return false;
}

export function realEscapeString(str: string | undefined) {
  if (!str) {
    return str;
  }

  return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, (char) => {
    switch (char) {
      case "\0":
        return "\\0";
      case "\x08":
        return "\\b";
      case "\x09":
        return "\\t";
      case "\x1a":
        return "\\z";
      case "\n":
        return "\\n";
      case "\r":
        return "\\r";
      case "`":
      case '"':
      case "'":
      case "\\":
      case "%":
        return "\\" + char;
    }
  });
}
