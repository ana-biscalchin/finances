ALTER TABLE "categories" ADD COLUMN "color" text DEFAULT 'gray' NOT NULL;--> statement-breakpoint
UPDATE "categories"
SET "color" = CASE "id"
  WHEN 'cat-trabalho' THEN 'green'
  WHEN 'cat-rendimentos' THEN 'teal'
  WHEN 'cat-outras-receitas' THEN 'lime'
  WHEN 'cat-moradia' THEN 'blue'
  WHEN 'cat-alimentacao' THEN 'orange'
  WHEN 'cat-transporte' THEN 'yellow'
  WHEN 'cat-saude' THEN 'red'
  WHEN 'cat-lazer' THEN 'pink'
  WHEN 'cat-gastos-shuri' THEN 'violet'
  WHEN 'cat-educacao' THEN 'cyan'
  WHEN 'cat-servicos' THEN 'grape'
  WHEN 'cat-aportes' THEN 'indigo'
  ELSE "color"
END;
