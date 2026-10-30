'use client';

import { useEffect, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/cn';
import type { TableColumn } from '@/types';
import type { LegalPage } from '@/services/legalPages.service';

interface LegalPagesSortableTableProps {
  rows: LegalPage[];
  columns: TableColumn<LegalPage>[];
  onReorder: (orderedIds: number[]) => void;
  onRowClick?: (row: LegalPage) => void;
  isSaving?: boolean;
}

function SortableRow({
  row,
  columns,
  onRowClick,
  disabled,
}: {
  row: LegalPage;
  columns: TableColumn<LegalPage>[];
  onRowClick?: (row: LegalPage) => void;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        'transition-colors hover:bg-neutral-50/50',
        onRowClick && 'cursor-pointer',
        isDragging && 'relative z-10 bg-white shadow-md ring-1 ring-primary-100'
      )}
      onClick={() => onRowClick?.(row)}
    >
      <td className="w-10 whitespace-nowrap px-2 py-3" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={cn(
            'rounded-lg p-2 text-neutral-300 touch-none',
            disabled
              ? 'cursor-not-allowed opacity-40'
              : 'cursor-grab hover:bg-neutral-100 hover:text-secondary-500 active:cursor-grabbing'
          )}
          aria-label={`Drag to reorder ${row.title}`}
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <Bars3Icon className="h-5 w-5" />
        </button>
      </td>
      {columns.map((col) => {
        const value = (row as unknown as Record<string, unknown>)[col.key];
        return (
          <td key={col.key} className="whitespace-nowrap px-4 py-3 text-sm text-secondary-500">
            {col.render ? col.render(value, row) : String(value ?? '—')}
          </td>
        );
      })}
    </tr>
  );
}

export function LegalPagesSortableTable({
  rows,
  columns,
  onReorder,
  onRowClick,
  isSaving = false,
}: LegalPagesSortableTableProps) {
  const [items, setItems] = useState(rows);

  useEffect(() => {
    setItems(rows);
  }, [rows]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setItems((prev) => {
      const oldIndex = prev.findIndex((r) => r.id === active.id);
      const newIndex = prev.findIndex((r) => r.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      const next = arrayMove(prev, oldIndex, newIndex);
      onReorder(next.map((r) => r.id));
      return next;
    });
  };

  const ids = items.map((r) => r.id);

  return (
    <div className="table-container">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-100 bg-neutral-50/50">
              <th className="w-10 px-2 py-3" aria-label="Reorder" />
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              {items.map((row) => (
                <SortableRow
                  key={row.id}
                  row={row}
                  columns={columns}
                  onRowClick={onRowClick}
                  disabled={isSaving}
                />
              ))}
            </SortableContext>
          </tbody>
        </table>
      </DndContext>
    </div>
  );
}
