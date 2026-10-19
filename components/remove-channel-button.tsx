"use client";

import { removeSong, type SongFormState } from "@/app/(site)/(app)/music/actions";
import { useActionState, useState, type FormEvent } from "react";

const INITIAL: SongFormState = {};

export function RemoveChannelButton({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(removeSong, INITIAL);
  const [armed, setArmed] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!armed) {
      event.preventDefault();
      setArmed(true);
    }
  }

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      onKeyDown={(event) => {
        if (event.key === "Escape") setArmed(false);
      }}
      className="flex items-center gap-3"
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className={`btn btn-sm ${armed ? "btn-danger" : ""}`}
        disabled={pending}
        onBlur={() => setArmed(false)}
      >
        {pending ? "Removing…" : armed ? "Really remove?" : "Remove"}
      </button>
      {state.error ? (
        <span role="alert" className="field-error">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
