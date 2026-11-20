import { PROJECT_KEY_REGEX } from "../constants/project.constant";

// The sidebar's "Board" opens the board you used last. It's a per-browser
// convenience only, so storage being unavailable (private mode, blocked) is fine.
const STORAGE_KEY = "taskflow:last-board";

export function readLastBoard(): string | null {
  try {
    const key = window.localStorage.getItem(STORAGE_KEY);
    return key && PROJECT_KEY_REGEX.test(key) ? key : null;
  } catch {
    return null;
  }
}

export function rememberBoard(projectKey: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, projectKey);
  } catch {
    // ignore: nothing depends on it
  }
}

// e.g. the project was deleted or the user lost access
export function forgetBoard(projectKey: string) {
  try {
    if (window.localStorage.getItem(STORAGE_KEY) === projectKey) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}
