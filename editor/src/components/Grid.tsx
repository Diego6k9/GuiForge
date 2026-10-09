export interface CellView {
  slot: number;
  label: string;
  color?: string;
  title?: string;
  selected: boolean;
  content: boolean;
  pattern: boolean;
}

interface GridProps {
  cells: CellView[];
  onCell: (slot: number) => void;
  disabled?: boolean;
}

/** Inventory-style 9-column grid used for the editor canvas. */
export function Grid({ cells, onCell, disabled }: GridProps) {
  return (
    <div className="mc-grid editor-grid" role="grid">
      {cells.map((cell) => {
        const classes = ['mc-slot'];
        if (cell.selected) classes.push('selected');
        if (cell.content) classes.push('content');
        if (cell.pattern) classes.push('pattern');
        return (
          <button
            key={cell.slot}
            type="button"
            className={classes.join(' ')}
            style={cell.color ? { background: cell.color } : undefined}
            title={cell.title ?? `Slot ${cell.slot}`}
            onClick={() => onCell(cell.slot)}
            disabled={disabled}
          >
            {cell.label}
          </button>
        );
      })}
    </div>
  );
}
