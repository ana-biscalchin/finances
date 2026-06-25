import { Box, NumberInput, Text, TextInput } from "@mantine/core";
import { useEffect, useState } from "react";

import { formatMoney, moneyFromCents } from "@finances/domain";

import { formatBusinessDateForDisplay } from "../date-format";
import { BusinessDateInput } from "./BusinessDateInput";

type QuickTextEditProps = {
  value: string;
  onSave: (value: string) => void | Promise<void>;
  fw?: number;
  placeholder?: string;
  disabled?: boolean;
};

type QuickAmountEditProps = {
  valueCents: number;
  onSave: (valueCents: number) => void | Promise<void>;
  color?: string;
  prefix?: string;
  disabled?: boolean;
};

type QuickDateEditProps = {
  value: string;
  referenceMonth: string;
  onSave: (value: string) => void | Promise<void>;
  disabled?: boolean;
};

export function QuickTextEdit({ value, onSave, fw, placeholder, disabled }: QuickTextEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!isEditing) {
      setDraft(value);
    }
  }, [isEditing, value]);

  async function commit() {
    const nextValue = draft.trim();
    setIsEditing(false);
    if (nextValue && nextValue !== value) {
      await onSave(nextValue);
    }
  }

  if (disabled) {
    return (
      <Text size="inherit" fw={fw}>
        {value || placeholder || "-"}
      </Text>
    );
  }

  if (isEditing) {
    return (
      <TextInput
        size="xs"
        value={draft}
        placeholder={placeholder}
        autoFocus
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void commit();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setDraft(value);
            setIsEditing(false);
          }
        }}
      />
    );
  }

  return (
    <Text
      size="inherit"
      fw={fw}
      role="button"
      tabIndex={0}
      title="Clique para editar"
      style={{ cursor: "text" }}
      onClick={() => setIsEditing(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          setIsEditing(true);
        }
      }}
    >
      {value || placeholder || "-"}
    </Text>
  );
}

export function QuickAmountEdit({ valueCents, onSave, color, prefix = "", disabled }: QuickAmountEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<number | string>(valueCents / 100);

  useEffect(() => {
    if (!isEditing) {
      setDraft(valueCents / 100);
    }
  }, [isEditing, valueCents]);

  async function commit() {
    const numericValue =
      typeof draft === "number" ? draft : Number(String(draft).replace(",", "."));
    const nextValueCents = Number.isFinite(numericValue)
      ? Math.round(numericValue * 100)
      : valueCents;
    setIsEditing(false);
    if (nextValueCents > 0 && nextValueCents !== valueCents) {
      await onSave(nextValueCents);
    }
  }

  if (disabled) {
    return (
      <Text size="inherit" fw={700} c={color} style={{ whiteSpace: "nowrap" }}>
        {prefix}
        {formatMoney(moneyFromCents(valueCents))}
      </Text>
    );
  }

  if (isEditing) {
    return (
      <NumberInput
        size="xs"
        min={0}
        decimalScale={2}
        fixedDecimalScale
        decimalSeparator=","
        thousandSeparator="."
        prefix="R$ "
        value={draft}
        autoFocus
        onFocus={(event) => event.currentTarget.select()}
        onChange={setDraft}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void commit();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setDraft(valueCents / 100);
            setIsEditing(false);
          }
        }}
      />
    );
  }

  return (
    <Text
      size="inherit"
      fw={700}
      c={color}
      role="button"
      tabIndex={0}
      title="Clique para editar"
      style={{ cursor: "text", whiteSpace: "nowrap" }}
      onClick={() => setIsEditing(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          setIsEditing(true);
        }
      }}
    >
      {prefix}
      {formatMoney(moneyFromCents(valueCents))}
    </Text>
  );
}

export function QuickDateEdit({ value, referenceMonth, onSave, disabled }: QuickDateEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!isEditing) {
      setDraft(value);
    }
  }, [isEditing, value]);

  async function commit(nextValue = draft) {
    setIsEditing(false);
    if (nextValue && nextValue !== value) {
      await onSave(nextValue);
    }
  }

  if (disabled) {
    return (
      <Text size="inherit" c="dimmed" style={{ whiteSpace: "nowrap" }}>
        {formatBusinessDateForDisplay(value)}
      </Text>
    );
  }

  if (isEditing) {
    return (
      <Box w={190}>
        <BusinessDateInput
          label=""
          value={draft}
          referenceMonth={referenceMonth}
          onChange={(nextValue) => {
            setDraft(nextValue);
            void commit(nextValue);
          }}
        />
      </Box>
    );
  }

  return (
    <Text
      size="inherit"
      c="dimmed"
      role="button"
      tabIndex={0}
      title="Clique para editar"
      style={{ cursor: "text", whiteSpace: "nowrap" }}
      onClick={() => setIsEditing(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          setIsEditing(true);
        }
      }}
    >
      {formatBusinessDateForDisplay(value)}
    </Text>
  );
}
