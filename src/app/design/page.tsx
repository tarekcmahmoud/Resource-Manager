'use client';
import { useState } from 'react';
import { Frame } from '@/components/Frame';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Pill } from '@/components/Pill';
import { Field } from '@/components/Field';
import { Icon } from '@/components/Icon';
import s from './design.module.css';

const COLORS = ['bg', 'surface', 'ink', 'muted', 'line', 'tone-1', 'tone-2', 'cross', 'accent'];
const TYPE = [['2xl', 'Focus view title'], ['xl', 'Quote on a card'], ['lg', 'Panel title'], ['base', 'Body text'], ['md', 'Buttons and inputs'], ['sm', 'Meta and labels'], ['xs', 'Badges']];

/** Living style guide: every token and component in one place. Check visual edits here. */
export default function DesignPage() {
  const [tags, setTags] = useState(['steel']);
  const toggle = (t: string) => setTags((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]));
  return (
    <main className={s.page}>
      <header className={s.head}>
        <h1>Design system</h1>
        <p>Tokens live in <code>src/styles/tokens.css</code>. Components live in <code>src/components</code> and use only tokens.</p>
      </header>

      <Section title="Colour">
        <div className={s.swatches}>
          {COLORS.map((c) => (
            <div key={c} className={s.swatch}><span style={{ background: `var(--color-${c})` }} /><code>--color-{c}</code></div>
          ))}
        </div>
      </Section>

      <Section title="Type">
        {TYPE.map(([k, use]) => (
          <div key={k} className={s.typeRow}><code>--text-{k}</code><span style={{ fontSize: `var(--text-${k})` }}>{use}</span></div>
        ))}
      </Section>

      <Section title="Buttons">
        <div className={s.row}>
          <Button variant="primary"><Icon name="add" />New submission</Button>
          <Button>Default</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Confirm delete</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm"><Icon name="ext" size={12} />Open all</Button>
          <Button size="sm" iconOnly aria-label="Pin" aria-pressed={true}><Icon name="pin" size={14} /></Button>
          <Button size="sm" iconOnly aria-label="Pin"><Icon name="pin" size={14} /></Button>
        </div>
      </Section>

      <Section title="Chips">
        <div className={s.row}>
          {['steel', 'lighting', 'joinery', 'ceramic'].map((t) => <Chip key={t} selected={tags.includes(t)} onClick={() => toggle(t)}>{t}</Chip>)}
        </div>
      </Section>

      <Section title="Pills (hover to expand)">
        <div className={s.row}>
          <Pill icon={<Icon name="ext" size={13} />} label="studio-example.com" href="#" />
          <Pill icon="S" label="steel" />
          <Pill icon="L" label="lighting" expanded />
        </div>
      </Section>

      <Section title="Fields">
        <div className={s.fields}>
          <Field label="Link" placeholder="https://" />
          <Field label="Name" defaultValue="Dezeen" error="This link is already saved in Design › News." />
        </div>
      </Section>

      <Section title="Frame (corner crosses)">
        <div className={s.row} style={{ gap: 48, padding: 16 }}>
          <Frame className={s.demo}>At rest</Frame>
          <Frame className={s.demo} interactive tabIndex={0}>Hover me</Frame>
          <Frame className={s.demo} active>Active</Frame>
        </div>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className={s.section}><h2>{title}</h2>{children}</section>;
}
