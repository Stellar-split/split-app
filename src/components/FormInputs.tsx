"use client";

import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

// ── Shared types ──────────────────────────────────────────────────────────────

interface BaseFieldProps {
  label: string;
  error?: string;
  helperText?: string;
  required?: boolean;
}

// ── Shared label / helper / error layout ─────────────────────────────────────

function FieldWrapper({
  id,
  label,
  required,
  error,
  helperText,
  children,
}: BaseFieldProps & { id: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="text-sm font-medium text-gray-200 dark:text-gray-200"
      >
        {label}
        {required && (
          <span className="ml-1 text-red-400" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : helperText ? (
        <p id={`${id}-helper`} className="text-xs text-gray-400">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

const inputBase =
  "w-full min-h-11 rounded-lg border bg-gray-800 px-4 py-2 text-sm text-gray-100 placeholder-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800 dark:text-gray-100";

const borderClass = (error?: string) =>
  error ? "border-red-500" : "border-gray-600 hover:border-gray-500";

// ── TextInput ─────────────────────────────────────────────────────────────────

export interface TextInputProps
  extends BaseFieldProps,
    Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  id: string;
}

export function TextInput({
  id,
  label,
  error,
  helperText,
  required,
  disabled,
  ...rest
}: TextInputProps) {
  return (
    <FieldWrapper id={id} label={label} error={error} helperText={helperText} required={required}>
      <input
        id={id}
        type="text"
        required={required}
        disabled={disabled}
        aria-required={required}
        aria-describedby={error ? `${id}-error` : helperText ? `${id}-helper` : undefined}
        aria-invalid={!!error}
        className={`${inputBase} ${borderClass(error)}`}
        {...rest}
      />
    </FieldWrapper>
  );
}

// ── NumberInput ───────────────────────────────────────────────────────────────

export interface NumberInputProps
  extends BaseFieldProps,
    Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  id: string;
}

export function NumberInput({
  id,
  label,
  error,
  helperText,
  required,
  disabled,
  ...rest
}: NumberInputProps) {
  return (
    <FieldWrapper id={id} label={label} error={error} helperText={helperText} required={required}>
      <input
        id={id}
        type="number"
        required={required}
        disabled={disabled}
        aria-required={required}
        aria-describedby={error ? `${id}-error` : helperText ? `${id}-helper` : undefined}
        aria-invalid={!!error}
        className={`${inputBase} ${borderClass(error)}`}
        {...rest}
      />
    </FieldWrapper>
  );
}

// ── Textarea ──────────────────────────────────────────────────────────────────

export interface TextareaProps
  extends BaseFieldProps,
    Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, never> {
  id: string;
}

export function Textarea({
  id,
  label,
  error,
  helperText,
  required,
  disabled,
  ...rest
}: TextareaProps) {
  return (
    <FieldWrapper id={id} label={label} error={error} helperText={helperText} required={required}>
      <textarea
        id={id}
        required={required}
        disabled={disabled}
        aria-required={required}
        aria-describedby={error ? `${id}-error` : helperText ? `${id}-helper` : undefined}
        aria-invalid={!!error}
        className={`${inputBase} min-h-24 resize-y ${borderClass(error)}`}
        {...rest}
      />
    </FieldWrapper>
  );
}

// ── Select ────────────────────────────────────────────────────────────────────

export interface SelectProps
  extends BaseFieldProps,
    Omit<SelectHTMLAttributes<HTMLSelectElement>, never> {
  id: string;
  options: { value: string; label: string }[];
}

export function Select({
  id,
  label,
  error,
  helperText,
  required,
  disabled,
  options,
  ...rest
}: SelectProps) {
  return (
    <FieldWrapper id={id} label={label} error={error} helperText={helperText} required={required}>
      <select
        id={id}
        required={required}
        disabled={disabled}
        aria-required={required}
        aria-describedby={error ? `${id}-error` : helperText ? `${id}-helper` : undefined}
        aria-invalid={!!error}
        className={`${inputBase} ${borderClass(error)}`}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
}

// ── DatePicker ────────────────────────────────────────────────────────────────

export interface DatePickerProps
  extends BaseFieldProps,
    Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  id: string;
}

export function DatePicker({
  id,
  label,
  error,
  helperText,
  required,
  disabled,
  ...rest
}: DatePickerProps) {
  return (
    <FieldWrapper id={id} label={label} error={error} helperText={helperText} required={required}>
      <input
        id={id}
        type="date"
        required={required}
        disabled={disabled}
        aria-required={required}
        aria-describedby={error ? `${id}-error` : helperText ? `${id}-helper` : undefined}
        aria-invalid={!!error}
        className={`${inputBase} ${borderClass(error)}`}
        {...rest}
      />
    </FieldWrapper>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────

export interface ToggleProps extends BaseFieldProps {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

export function Toggle({
  id,
  label,
  error,
  helperText,
  required,
  disabled,
  checked,
  onChange,
}: ToggleProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="text-sm font-medium text-gray-200 dark:text-gray-200 cursor-pointer"
        >
          {label}
          {required && (
            <span className="ml-1 text-red-400" aria-hidden="true">
              *
            </span>
          )}
        </label>
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-required={required}
          aria-describedby={error ? `${id}-error` : helperText ? `${id}-helper` : undefined}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 ${
            checked ? "bg-indigo-600" : "bg-gray-600"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              checked ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : helperText ? (
        <p id={`${id}-helper`} className="text-xs text-gray-400">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

// ── Checkbox ──────────────────────────────────────────────────────────────────

export interface CheckboxProps extends BaseFieldProps {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

export function Checkbox({
  id,
  label,
  error,
  helperText,
  required,
  disabled,
  checked,
  onChange,
}: CheckboxProps) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="inline-flex items-center gap-2 cursor-pointer select-none"
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          required={required}
          disabled={disabled}
          aria-required={required}
          aria-describedby={error ? `${id}-error` : helperText ? `${id}-helper` : undefined}
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800"
        />
        <span className="text-sm font-medium text-gray-200 dark:text-gray-200">
          {label}
          {required && (
            <span className="ml-1 text-red-400" aria-hidden="true">
              *
            </span>
          )}
        </span>
      </label>
      {error ? (
        <p id={`${id}-error`} className="text-xs text-red-400 ml-6" role="alert">
          {error}
        </p>
      ) : helperText ? (
        <p id={`${id}-helper`} className="text-xs text-gray-400 ml-6">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
