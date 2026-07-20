import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { themeWhiteboardTokens } from '@/styles/themeTokens';
import { clampRgbChannel, hexToRgb, hsvToRgb, rgbToHex, rgbToHsv, type HsvColor } from '../../model/whiteboardColor';
import { whiteboardFloatingPanelClassName } from './WhiteboardToolbarPrimitives';

interface WhiteboardColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

type EyeDropperWindow = Window & {
  EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
};

export function WhiteboardColorPicker({ color, onChange }: WhiteboardColorPickerProps) {
  const { t } = useI18n();
  const initialRgb = hexToRgb(color) ?? { r: 39, g: 39, b: 42 };
  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState(() => rgbToHsv(initialRgb));
  const [hexInput, setHexInput] = useState(() => rgbToHex(initialRgb));
  const nativeColorInputRef = useRef<HTMLInputElement>(null);
  const rgb = hsvToRgb(hsv);
  const resolvedHex = rgbToHex(rgb);

  const resetDraft = () => {
    const nextRgb = hexToRgb(color) ?? initialRgb;
    setHsv(rgbToHsv(nextRgb));
    setHexInput(rgbToHex(nextRgb));
  };
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) resetDraft();
    setOpen(nextOpen);
  };
  const updateFromRgb = (nextRgb: { r: number; g: number; b: number }) => {
    setHsv(rgbToHsv(nextRgb));
    setHexInput(rgbToHex(nextRgb));
  };
  const handleHexChange = (value: string) => {
    setHexInput(value);
    const nextRgb = hexToRgb(value);
    if (nextRgb) setHsv(rgbToHsv(nextRgb));
  };
  const updateChannel = (channel: 'r' | 'g' | 'b', value: string) => {
    updateFromRgb({ ...rgb, [channel]: clampRgbChannel(value) });
  };
  const chooseSwatch = (swatch: string) => {
    const nextRgb = hexToRgb(swatch);
    if (nextRgb) updateFromRgb(nextRgb);
  };
  const pickFromScreen = async () => {
    const EyeDropper = (window as EyeDropperWindow).EyeDropper;
    if (!EyeDropper) {
      nativeColorInputRef.current?.click();
      return;
    }
    try {
      const result = await new EyeDropper().open();
      chooseSwatch(result.sRGBHex);
    } catch {}
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
        type="button"
        aria-label={t('whiteboard.customColor')}
        aria-pressed={open}
        onClick={() => handleOpenChange(!open)}
        className="flex size-[var(--vlaina-size-24px)] shrink-0 items-center justify-center rounded-[var(--vlaina-radius-circle)] border-2 border-[var(--vlaina-color-picker-white)] shadow-[var(--vlaina-shadow-sm)] transition-transform hover:scale-[var(--vlaina-scale-105)]"
        style={{ backgroundImage: 'var(--vlaina-color-picker-rainbow)' }}
        />
      </PopoverTrigger>

      <PopoverContent side="top" align="center" sideOffset={8} role="dialog" aria-label={t('whiteboard.customColor')} className={cn('max-h-[var(--vlaina-whiteboard-color-picker-max-height)] w-[var(--vlaina-size-560px)] max-w-[var(--vlaina-whiteboard-panel-max-width)] overflow-y-auto rounded-[var(--vlaina-radius-26px)] p-3', whiteboardFloatingPanelClassName)}>

        <div className="grid gap-3 sm:h-[var(--vlaina-size-280px)] sm:grid-cols-[minmax(0,1fr)_var(--vlaina-size-28px)_var(--vlaina-size-160px)]">
          <SaturationValueField hsv={hsv} onChange={setHsv} />
          <HueField hsv={hsv} onChange={setHsv} />

          <div className="grid content-start gap-2 sm:grid-cols-[var(--vlaina-size-24px)_minmax(0,1fr)]">
            <div aria-hidden="true" className="col-span-full h-[var(--vlaina-size-48px)] rounded-[var(--vlaina-radius-8px)]" style={{ backgroundColor: resolvedHex }} />
            <ColorInput label="HEX" value={hexInput} onBlur={() => setHexInput(resolvedHex)} onChange={handleHexChange} />
            <ColorInput label="R" type="number" value={String(Math.round(rgb.r))} onChange={(value) => updateChannel('r', value)} />
            <ColorInput label="G" type="number" value={String(Math.round(rgb.g))} onChange={(value) => updateChannel('g', value)} />
            <ColorInput label="B" type="number" value={String(Math.round(rgb.b))} onChange={(value) => updateChannel('b', value)} />
          </div>
        </div>

        <div className="flex flex-wrap justify-between gap-2">
          <button type="button" onClick={pickFromScreen} className="h-9 rounded-[var(--vlaina-radius-8px)] bg-[var(--vlaina-color-control-hover-bg)] px-4 text-[var(--vlaina-font-13)] font-medium">
            {t('whiteboard.pickColor')}
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-[var(--vlaina-radius-8px)] bg-[var(--vlaina-color-control-hover-bg)] px-4 text-[var(--vlaina-font-13)] font-medium">{t('common.cancel')}</button>
            <button type="button" onClick={() => { onChange(resolvedHex); setOpen(false); }} className="h-9 rounded-[var(--vlaina-radius-8px)] bg-[var(--vlaina-accent)] px-4 text-[var(--vlaina-font-13)] font-medium text-[var(--vlaina-color-inverse-text)]">{t('common.apply')}</button>
          </div>
        </div>
        <input ref={nativeColorInputRef} type="color" value={resolvedHex} aria-label={t('whiteboard.pickColor')} onChange={(event) => chooseSwatch(event.target.value)} className="sr-only" />
      </PopoverContent>
    </Popover>
  );
}

function SaturationValueField({ hsv, onChange }: { hsv: HsvColor; onChange: (color: HsvColor) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const hueColor = rgbToHex(hsvToRgb({ h: hsv.h, s: 1, v: 1 }));
  const update = (event: PointerEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    onChange({ ...hsv, s: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)), v: Math.min(1, Math.max(0, 1 - (event.clientY - rect.top) / rect.height)) });
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const delta = 0.01;
    const nextSaturation = hsv.s + (event.key === 'ArrowRight' ? delta : event.key === 'ArrowLeft' ? -delta : 0);
    const nextValue = hsv.v + (event.key === 'ArrowUp' ? delta : event.key === 'ArrowDown' ? -delta : 0);
    onChange({ ...hsv, s: Math.min(1, Math.max(0, nextSaturation)), v: Math.min(1, Math.max(0, nextValue)) });
  };
  return (
    <div ref={ref} role="slider" tabIndex={0} aria-label="Saturation and brightness" aria-valuetext={`${Math.round(hsv.s * 100)}%, ${Math.round(hsv.v * 100)}%`} onKeyDown={handleKeyDown} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); update(event); }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) update(event); }} className="relative min-h-[var(--vlaina-size-240px)] touch-none overflow-hidden rounded-[var(--vlaina-radius-8px)] border border-[var(--vlaina-color-subtle-border-strong)] sm:min-h-0" style={{ backgroundColor: hueColor, backgroundImage: themeWhiteboardTokens.colorPickerSaturationValueGradient }}>
      <span aria-hidden="true" className="pointer-events-none absolute size-[var(--vlaina-size-18px)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--vlaina-radius-circle)] border-2 border-[var(--vlaina-color-picker-white)] shadow-[var(--vlaina-shadow-sm)]" style={{ backgroundColor: rgbToHex(hsvToRgb(hsv)), left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }} />
    </div>
  );
}

function HueField({ hsv, onChange }: { hsv: HsvColor; onChange: (color: HsvColor) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const hueColor = rgbToHex(hsvToRgb({ h: hsv.h, s: 1, v: 1 }));
  const update = (event: PointerEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) onChange({ ...hsv, h: Math.min(359.999, Math.max(0, ((event.clientY - rect.top) / rect.height) * 360)) });
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    onChange({ ...hsv, h: (hsv.h + (event.key === 'ArrowDown' ? 2 : 358)) % 360 });
  };
  return (
    <div ref={ref} role="slider" tabIndex={0} aria-label="Hue" aria-valuenow={Math.round(hsv.h)} aria-valuemin={0} aria-valuemax={360} onKeyDown={handleKeyDown} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); update(event); }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) update(event); }} className="relative min-h-[var(--vlaina-size-48px)] touch-none rounded-[var(--vlaina-radius-8px)]" style={{ backgroundImage: themeWhiteboardTokens.colorPickerHueGradient }}>
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-[-2px] h-[var(--vlaina-size-6px)] -translate-y-1/2 rounded-[var(--vlaina-radius-pill)] border-2 border-[var(--vlaina-color-picker-white)] shadow-[var(--vlaina-shadow-sm)]" style={{ backgroundColor: hueColor, top: `${hsv.h / 360 * 100}%` }} />
    </div>
  );
}

function ColorInput({ label, onBlur, onChange, type = 'text', value }: { label: string; onBlur?: () => void; onChange: (value: string) => void; type?: 'text' | 'number'; value: string }) {
  return (
    <label className="contents">
      <span className="self-center text-[var(--vlaina-font-13)] text-[var(--vlaina-color-text-secondary)]">{label}</span>
      <input type={type} min={type === 'number' ? 0 : undefined} max={type === 'number' ? 255 : undefined} value={value} onBlur={onBlur} onChange={(event) => onChange(event.target.value)} className="h-9 min-w-0 rounded-[var(--vlaina-radius-8px)] border border-[var(--vlaina-color-subtle-border-strong)] bg-[var(--vlaina-color-control-hover-bg)] px-2 font-mono text-[var(--vlaina-font-13)] text-[var(--vlaina-color-text-primary)] outline-none focus:border-[var(--vlaina-color-whiteboard-selected)]" />
    </label>
  );
}
