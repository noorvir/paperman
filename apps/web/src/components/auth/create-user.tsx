import { useState, type FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import { createAccount } from "@/lib/auth/functions";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { ErrorNotice } from "../page";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "../ui/dialog";

export function CreateUser() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
      setOpen(false);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not create user",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (!next) {
          setName("");
          setEmail("");
          setPassword("");
          setError("");
        }
      }}
    >
      <DialogTrigger render={<Button />}>
        <HugeiconsIcon icon={Add01Icon} aria-hidden="true" />
        Create user
      </DialogTrigger>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>
            Add a user with their own inbox. New users join as members.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          <fieldset disabled={pending} className="space-y-4">
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
              At least 12 characters. Share the password securely. A personal
              inbox is created for this account.
            </p>
          </fieldset>
          <ErrorNotice message={error} />
          <DialogFooter>
            <DialogClose
              render={
                <Button type="button" variant="outline" disabled={pending} />
              }
            >
              Cancel
            </DialogClose>
            <Button type="submit" loading={pending} disabled={pending}>
              Create user
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
