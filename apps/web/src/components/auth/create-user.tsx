import { useState, type FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import { createAccount } from "@/lib/auth/functions";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { ErrorNotice } from "../page";

export function CreateUser() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await createAccount({ data: { name, email, password } });
      setName("");
      setEmail("");
      setPassword("");
      await router.invalidate();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not create user",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="workspace-section border-t pt-4"
    >
      <h2 className="workspace-title">Create user</h2>
      <label className="field-label">
        Name
        <Input
          value={name}
          required
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="field-label">
        Email
        <Input
          type="email"
          value={email}
          required
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label className="field-label">
        Initial password
        <Input
          type="password"
          autoComplete="new-password"
          minLength={12}
          value={password}
          required
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <p className="workspace-description">
        At least 12 characters. Share the password securely. A personal inbox is
        created for this account.
      </p>
      <ErrorNotice message={error} />
      <Button type="submit" loading={pending}>
        Create user
      </Button>
    </form>
  );
}
