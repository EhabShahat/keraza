import { InputRendererProps } from "./types";
import TrueFalseInput from "./inputs/TrueFalseInput";
import SingleChoiceInput from "./inputs/SingleChoiceInput";
import MultiSelectInput from "./inputs/MultiSelectInput";
import ParagraphInput from "./inputs/ParagraphInput";

export default function InputRenderer({
  type,
  q,
  value,
  onChange,
  disabled,
  legendId
}: InputRendererProps) {
  switch (type) {
    case "true_false": {
      // Don't convert to Boolean - keep null/undefined as no selection
      const v = value as boolean | null | undefined;
      return (
        <TrueFalseInput
          value={v}
          onChange={(val) => onChange(val)}
          disabled={disabled}
          required={q.required}
          id={legendId}
          legendId={legendId}
        />
      );
    }
    case "single_choice": {
      const opts = (q.options as string[] | null) ?? [];
      const v = (value as string) ?? "";
      return (
        <SingleChoiceInput
          options={opts}
          value={v}
          onChange={(val) => onChange(val)}
          disabled={disabled}
          required={q.required}
          id={legendId}
          legendId={legendId}
        />
      );
    }
    case "multiple_choice":
    case "multi_select": {
      const opts = (q.options as string[] | null) ?? [];
      const v = Array.isArray(value) ? (value as string[]) : [];
      return (
        <MultiSelectInput
          options={opts}
          value={v}
          onChange={(val) => onChange(val)}
          disabled={disabled}
          required={q.required}
          id={legendId}
          legendId={legendId}
        />
      );
    }
    case "paragraph": {
      const v = (value as string) ?? "";
      return (
        <ParagraphInput
          value={v}
          onChange={(val) => onChange(val)}
          disabled={disabled}
          required={q.required}
          id={legendId}
          legendId={legendId}
        />
      );
    }
    default:
      return <div>Unsupported question type</div>;
  }
}