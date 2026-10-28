export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string) {
  return emailPattern.test(email.trim()) ? undefined : 'Enter a valid email address.';
}

export function validatePassword(password: string) {
  return password.length >= 8 ? undefined : 'Use at least 8 characters.';
}

export function validatePasswordConfirmation(password: string, confirmation: string) {
  return password === confirmation ? undefined : 'Passwords do not match.';
}
