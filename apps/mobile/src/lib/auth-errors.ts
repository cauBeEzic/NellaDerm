type NamedError = Error & { name?: string };

export function authErrorMessage(error: unknown) {
  const name = error instanceof Error ? (error as NamedError).name : '';

  switch (name) {
    case 'AuthNotConfigured':
      return 'The demo sign-in service is not configured on this build.';
    case 'CodeMismatchException':
      return 'That code is not correct. Check the email and try again.';
    case 'ExpiredCodeException':
      return 'That code has expired. Request a new one and try again.';
    case 'InvalidPasswordException':
      return 'Use at least 8 characters for your password.';
    case 'LimitExceededException':
    case 'TooManyFailedAttemptsException':
    case 'TooManyRequestsException':
      return 'Too many attempts were made. Wait a little while, then try again.';
    case 'NetworkError':
      return 'We could not reach the sign-in service. Check your connection and try again.';
    case 'NotAuthorizedException':
    case 'UserNotFoundException':
      return 'The email or password is not correct.';
    case 'UsernameExistsException':
      return 'An account may already use this email. Try signing in or resetting your password.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
