# Icon System

## Usage
Always use the central `Icon` component. **Do not** import icon libraries directly.

```tsx
import { Icon } from '@/components/ui/icons';

<Icon name="common.add" size="md" />
```

## Sizing
Use the preset sizes for consistency:
- `xs`
- `sm`
- `md` (Default)
- `lg`
- `xl`

## Adding New Icons
1.  Import the icon in `src/components/ui/icons/registry.ts`.
2.  Add it to the `icons` object with a semantic name (e.g., `category.action`).

## Naming Convention
- `common.*`: Global actions (add, edit, delete, close).
- `nav.*`: Navigation (arrows, chevrons, external).
- `file.*`: Files and folders.
- `ai.*`: AI features.
- `sidebar.*`: App module icons.
- `theme.*`: Appearance modes.