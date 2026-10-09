export interface CellView {
    slot: number;
    label: string;
    color?: string;
    title?: string;
    selected: boolean;
    content: boolean;
    pattern: boolean;
    error: boolean;
    inDrag: boolean;
}

interface GridProps {
    cells: CellView[];
    onCellDown: (slot: number) => void;
    onCellEnter: (slot: number) => void;
    disabled?: boolean;
}

/** Inventory-style 9-column grid. Press and drag paints a rectangle; the app decides what that means. */
export function Grid({cells, onCellDown, onCellEnter, disabled}: GridProps) {
    return (
        <div className="mc-grid editor-grid" role="grid">
            {cells.map((cell) => {
                const classes = ['mc-slot'];
                if (cell.selected) classes.push('selected');
                if (cell.content) classes.push('content');
                if (cell.pattern) classes.push('pattern');
                if (cell.error) classes.push('error');
                if (cell.inDrag) classes.push('in-drag');
                return (
                    <button
                        key={cell.slot}
                        type="button"
                        className={classes.join(' ')}
                        style={cell.color ? {background: cell.color} : undefined}
                        title={cell.title ?? `Slot ${cell.slot}`}
                        onMouseDown={(e) => {
                            if (e.button !== 0 || disabled) return;
                            e.preventDefault();
                            onCellDown(cell.slot);
                        }}
                        onMouseEnter={() => onCellEnter(cell.slot)}
                        disabled={disabled}
                    >
                        {cell.label}
                    </button>
                );
            })}
        </div>
    );
}
