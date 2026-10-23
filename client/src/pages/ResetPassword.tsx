import { Redirect } from "wouter";

/** Legacy email-reset links now lead to the username recovery form. */
export default function ResetPasswordPage() {
  return <Redirect to="/account" />;
}
