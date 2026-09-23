import "server-only";

export function normalizePlayerNickname(value: string): string {
  if (typeof value !== "string" || /[\p{Cc}\p{Cf}]/u.test(value)) {
    throw new Error("Player name cannot contain control characters.");
  }

  const normalized = value.trim().replace(/\s+/gu, " ");
  const visibleCharacters = Array.from(normalized).length;
  if (visibleCharacters < 2 || visibleCharacters > 24) {
    throw new Error("Player name must contain between 2 and 24 characters.");
  }

  return normalized;
}

export function normalizeNicknameKey(value: string): string {
  return normalizePlayerNickname(value).toLocaleLowerCase("en-US");
}
