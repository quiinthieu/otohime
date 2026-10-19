"use client";

import { addSong, type SongFormState } from "@/app/(site)/(app)/music/actions";
import { Field } from "@/components/field";
import { SWATCH_KEYS } from "@/lib/songs";
import { useActionState, useEffect, useId, useRef } from "react";

const INITIAL: SongFormState = {};

export function AddChannelForm() {
  const [state, formAction, pending] = useActionState(addSong, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const colourId = useId();
  const errors = state.errors ?? {};

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="mt-3 grid max-w-xl gap-4">
      <Field
        label="YouTube link"
        name="video"
        placeholder="https://youtu.be/…"
        autoComplete="off"
        error={errors.video}
        required
      />
      <Field label="Title" name="title" maxLength={80} error={errors.title} required />
      <Field label="Artist" name="artist" maxLength={80} error={errors.artist} required />
      <Field label="Note (optional)" name="note" maxLength={200} error={errors.note} />
      <div>
        <label htmlFor={colourId} className="label">
          Colour
        </label>
        <select
          id={colourId}
          name="colour"
          className="field"
          defaultValue={SWATCH_KEYS[0]}
          aria-invalid={errors.colour ? true : undefined}
        >
          {SWATCH_KEYS.map((key) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </select>
        {errors.colour ? <p className="field-error">{errors.colour}</p> : null}
      </div>
      {state.error ? (
        <p role="alert" className="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok && !pending ? (
        <p role="status" className="alert" data-tone="ok">
          Channel added.
        </p>
      ) : null}
      <div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Adding…" : "Add channel"}
        </button>
      </div>
    </form>
  );
}
