const KEY = "campus_attendance_user";

export function saveUser(user: any) {
  localStorage.setItem(KEY, JSON.stringify(user));
}

export function getUser() {
  const raw = localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : null;
}

/** Backward compat name */
export function loadUser() {
  return getUser();
}

export function clearUser() {
  localStorage.removeItem(KEY);
}
