import {
  ChangeEvent,
  forwardRef,
  InputHTMLAttributes,
  ReactNode,
  useEffect,
  useId,
  useRef,
} from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "./cn";

const CONTROL =
  "w-full rounded-lg border bg-white text-gray-900 placeholder:text-gray-400 transition-colors outline-none focus:border-yellow focus:ring-4 focus:ring-yellow/30 disabled:bg-gray-100 disabled:text-gray-500 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:[color-scheme:dark]";

type AnyChange = (e: ChangeEvent<HTMLInputElement & HTMLTextAreaElement & HTMLSelectElement>) => void;

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "onChange"> {
  label: string;
  helperText?: ReactNode;
  error?: boolean;
  multiline?: boolean;
  minRows?: number;
  /** Renders a native <select>; pass <option> children. */
  select?: boolean;
  size?: "sm" | "md";
  children?: ReactNode;
  onChange?: AnyChange;
}

/**
 * Labelled input / textarea / select. Forwards its ref to the underlying
 * control, so react-hook-form's `{...field}` spreads straight onto it.
 */
export const TextField = forwardRef<HTMLInputElement & HTMLTextAreaElement & HTMLSelectElement, TextFieldProps>(
  function TextField(
    { label, helperText, error, multiline, minRows = 2, select, size = "md", className, children, required, id, value, ...rest },
    ref
  ) {
    const autoId = useId();
    const fieldId = id ?? autoId;
    const helperId = helperText ? `${fieldId}-help` : undefined;
    const controlClass = cn(
      CONTROL,
      size === "sm" ? "h-9 px-3 text-sm" : "h-10 px-3 text-sm",
      error
        ? "border-danger focus:border-danger focus:ring-danger/20"
        : "border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500"
    );
    const shared = {
      id: fieldId,
      required,
      "aria-invalid": error || undefined,
      "aria-describedby": helperId,
      value: value ?? "",
    };

    let control: ReactNode;
    if (select) {
      control = (
        <div className="relative">
          <select
            ref={ref}
            {...shared}
            {...(rest as object)}
            className={cn(controlClass, "appearance-none pr-9")}
          >
            {children}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-gray-500" />
        </div>
      );
    } else if (multiline) {
      control = (
        <textarea
          ref={ref}
          rows={minRows}
          {...shared}
          {...(rest as object)}
          className={cn(controlClass, "h-auto resize-y py-2 leading-relaxed")}
        />
      );
    } else {
      control = <input ref={ref} {...shared} {...rest} className={controlClass} />;
    }

    return (
      <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
        <label htmlFor={fieldId} className="text-xs font-semibold tracking-wide text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </label>
        {control}
        {helperText && (
          <p id={helperId} className={cn("text-xs", error ? "text-danger" : "text-gray-500 dark:text-gray-400")}>
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  indeterminate?: boolean;
  label?: ReactNode;
}

export function Checkbox({ indeterminate = false, label, className, ...rest }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const box = (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        "size-4 shrink-0 rounded border-gray-400 accent-yellow disabled:opacity-50",
        !label && className
      )}
      {...rest}
    />
  );
  if (!label) return box;
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2 text-sm text-gray-800 dark:text-gray-200", className)}>
      {box}
      {label}
    </label>
  );
}

interface SegmentedProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}

export function Segmented<T extends string>({ value, options, onChange, label }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-semibold transition-colors",
            value === o.value
              ? "bg-yellow text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
