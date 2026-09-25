import React, { useMemo, useState } from 'react';
import {
  DataGrid,
  type DataGridProps,
  type GridColDef,
  type GridRowId,
  type GridValidRowModel,
} from '@mui/x-data-grid';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { type SxProps, type Theme } from '@mui/material/styles';
import { CustomCollapseIcon, CustomExpandIcon } from './icons';

export interface AppDataGridProps<R extends GridValidRowModel = any>
  extends Omit<DataGridProps<R>, 'columns' | 'rows'> {
  rows: R[];
  columns: GridColDef<R>[];
  toolbar?: React.ReactNode;
  renderDetailPanel?: (row: R) => React.ReactNode;
  expandedRowIds?: Set<GridRowId>;
  onExpandedRowIdsChange?: (expandedIds: Set<GridRowId>) => void;
  emptyMessage?: string;
  wrapperSx?: SxProps<Theme>;
}

export function AppDataGrid<R extends GridValidRowModel = any>({
  rows,
  columns,
  toolbar,
  renderDetailPanel,
  expandedRowIds: controlledExpandedIds,
  onExpandedRowIdsChange,
  emptyMessage = 'ไม่มีข้อมูล',
  rowHeight = 72,
  loading = false,
  sx,
  wrapperSx,
  getRowId: customGetRowId,
  ...rest
}: AppDataGridProps<R>) {
  const [internalExpandedIds, setInternalExpandedIds] = useState<Set<GridRowId>>(new Set());

  const expandedIds = controlledExpandedIds ?? internalExpandedIds;

  const toggleRow = React.useCallback((id: GridRowId) => {
    const next = new Set(expandedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    if (onExpandedRowIdsChange) {
      onExpandedRowIdsChange(next);
    } else {
      setInternalExpandedIds(next);
    }
  }, [expandedIds, onExpandedRowIdsChange]);

  const resolveRowId = React.useCallback((row: any): GridRowId => {
    if (row.__isDetailRow) return row.id;
    if (customGetRowId) return customGetRowId(row);
    return row.id ?? row.skuCode ?? row.orderNo ?? row.code;
  }, [customGetRowId]);

  // Build grid columns with optional Master-Detail expand button
  const finalColumns = useMemo<GridColDef<any>[]>(() => {
    if (!renderDetailPanel) return columns;

    const totalColumns = columns.length + 1;

    const expandCol: GridColDef<any> = {
      field: '__detail_toggle__',
      headerName: '',
      width: 48,
      minWidth: 48,
      maxWidth: 48,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      colSpan: (_value, row) => (row.__isDetailRow ? totalColumns : 1),
      renderCell: (params) => {
        if (params.row.__isDetailRow) {
          return (
            <Box sx={{ width: '100%', py: 1.5, px: 2 }}>
              {renderDetailPanel(params.row.__parentRow)}
            </Box>
          );
        }
        const rowId = resolveRowId(params.row);
        const isExpanded = expandedIds.has(rowId);
        return (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              toggleRow(rowId);
            }}
            aria-label={isExpanded ? 'ย่อรายละเอียด' : 'ขยายรายละเอียด'}
            sx={{ p: 0.5 }}
          >
            {isExpanded ? <CustomCollapseIcon fontSize="small" /> : <CustomExpandIcon fontSize="small" />}
          </IconButton>
        );
      },
    };

    return [expandCol, ...columns];
  }, [columns, renderDetailPanel, expandedIds, resolveRowId, toggleRow]);

  // Insert synthetic detail rows when master row is expanded
  const finalRows = useMemo(() => {
    if (!renderDetailPanel) return rows;

    const result: any[] = [];
    for (const row of rows) {
      result.push(row);
      const rowId = resolveRowId(row);
      if (expandedIds.has(rowId)) {
        result.push({
          id: `__detail__${String(rowId)}`,
          __isDetailRow: true,
          __parentRow: row,
        });
      }
    }
    return result;
  }, [rows, renderDetailPanel, expandedIds, resolveRowId]);

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        minHeight: 300,
        backgroundColor: 'background.paper',
        ...wrapperSx,
      }}
    >
      {toolbar}
      <Box sx={{ flex: 1, width: '100%', minHeight: 240 }}>
        <DataGrid
          rows={finalRows}
          columns={finalColumns}
          loading={loading}
          getRowId={resolveRowId}
          rowHeight={rowHeight}
          getRowHeight={(params) => (params.model.__isDetailRow ? 'auto' : rowHeight)}
          getRowClassName={(params) => (params.row.__isDetailRow ? 'app-data-grid-detail-row' : '')}
          isRowSelectable={(params) => !params.row.__isDetailRow}
          disableRowSelectionOnClick
          slots={{
            noRowsOverlay: () => (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'text.secondary',
                  py: 4,
                }}
              >
                <Typography variant="body2">{emptyMessage}</Typography>
              </Box>
            ),
          }}
          sx={{
            border: 'none',
            '& .MuiDataGrid-main': {
              borderRadius: '16px',
            },
            '& .MuiDataGrid-columnHeaders': {
              borderRadius: '16px',
              color: 'text.secondary',
              borderBottom: 'none',
            },
            '& .MuiDataGrid-columnHeader': {
              padding: '0 16px',
              borderRight: 'none',
              '&:focus, &:focus-within': {
                outline: 'none',
              },
            },
            '& .MuiDataGrid-columnHeaderTitle': {
              fontWeight: 600,
            },
            '& .MuiDataGrid-columnSeparator': {
              display: 'none',
            },
            '& .MuiDataGrid-cell': {
              padding: '0 16px',
              '&:focus, &:focus-within': {
                outline: 'none',
              },
            },
            '& .app-data-grid-detail-row': {
              backgroundColor: (theme) =>
                theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(20, 28, 28, 0.015)',
              '&:hover': {
                backgroundColor: (theme) =>
                  theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(20, 28, 28, 0.015)',
              },
            },
            '& .app-data-grid-detail-row .MuiDataGrid-cell': {
              padding: 0,
              display: 'block',
              borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
            },
            ...sx,
          }}
          {...rest}
        />
      </Box>
    </Paper>
  );
}
