import type { Charge, Employee, FlatRow, Project, TimelineBlock, TimelineSummaryBlock } from '../types';
import { normalizeRange, rangesIntersect } from '../utils/date';

export function useSchedulerData(initialProjects: Project[], initialBlocks: TimelineBlock[]) {
  const projects = structuredClone(initialProjects);
  const blocks = [...initialBlocks];
  const collapsedProjects = new Set<string>();
  const collapsedCharges = new Set<string>();
  let blockSeq = blocks.length + 1;
  let employeeSeq = 1;

  function getVisibleRows(): FlatRow[] {
    return getVisibleRowsForProjects(projects.map((project) => project.id));
  }

  function getVisibleRowsForProjects(projectIds: string[]): FlatRow[] {
    const rows: FlatRow[] = [];
    const projectIdSet = new Set(projectIds);

    for (const project of projects) {
      if (!projectIdSet.has(project.id)) {
        continue;
      }
      rows.push({ id: project.id, kind: 'project', label: project.name, depth: 0 });
      if (collapsedProjects.has(project.id)) {
        continue;
      }

      for (const charge of project.charges) {
        rows.push({
          id: charge.id,
          kind: 'charge',
          label: charge.name,
          depth: 1,
          projectId: project.id,
          chargeId: charge.id,
        });

        if (collapsedCharges.has(charge.id)) {
          continue;
        }

        for (const employee of charge.employees) {
          rows.push({
            id: employee.id,
            kind: 'employee',
            label: employee.name,
            depth: 2,
            projectId: project.id,
            chargeId: charge.id,
          });
        }
      }
    }

    return rows;
  }

  function toggleGroup(rowId: string) {
    if (isProjectId(rowId)) {
      toggleSet(collapsedProjects, rowId);
      return;
    }
    if (findChargeById(rowId)) {
      toggleSet(collapsedCharges, rowId);
    }
  }

  function isCollapsed(row: FlatRow): boolean {
    return row.kind === 'project' ? collapsedProjects.has(row.id) : collapsedCharges.has(row.id);
  }

  function getEmployeeBlocks(employeeId: string): TimelineBlock[] {
    return blocks.filter((block) => block.employeeId === employeeId);
  }

  function addBlock(employeeId: string, title: string, startKey: string, endKey: string): TimelineBlock | null {
    const range = normalizeRange(startKey, endKey);
    if (hasBlockOverlap(employeeId, range.startKey, range.endKey)) {
      return null;
    }

    const block: TimelineBlock = {
      id: `block-${blockSeq++}`,
      employeeId,
      title,
      startKey: range.startKey,
      endKey: range.endKey,
    };
    blocks.push(block);
    return block;
  }

  function updateBlock(employeeId: string, blockId: string, patch: Partial<Omit<TimelineBlock, 'id' | 'employeeId'>>): boolean {
    const block = getBlock(employeeId, blockId);
    if (!block) {
      return false;
    }
    const next = { ...block, ...patch };
    const range = normalizeRange(next.startKey, next.endKey);
    if (hasBlockOverlap(employeeId, range.startKey, range.endKey, blockId)) {
      return false;
    }

    Object.assign(block, next);
    block.startKey = range.startKey;
    block.endKey = range.endKey;
    return true;
  }

  function deleteBlock(employeeId: string, blockId: string) {
    const index = blocks.findIndex((block) => block.employeeId === employeeId && block.id === blockId);
    if (index >= 0) {
      blocks.splice(index, 1);
    }
  }

  function addEmployee(chargeId: string, employeeName: string): Employee | null {
    const charge = findChargeById(chargeId);
    if (!charge) {
      return null;
    }

    const existing = charge.employees.find((employee) => normalizeName(employee.name) === normalizeName(employeeName));
    if (existing) {
      return existing;
    }

    const employee: Employee = {
      id: `new-employee-${employeeSeq++}`,
      name: employeeName,
    };
    charge.employees.push(employee);
    collapsedCharges.delete(chargeId);
    return employee;
  }

  function deleteEmployee(employeeId: string): boolean {
    for (const project of projects) {
      for (const charge of project.charges) {
        const index = charge.employees.findIndex((employee) => employee.id === employeeId);
        if (index >= 0) {
          charge.employees.splice(index, 1);
          for (let blockIndex = blocks.length - 1; blockIndex >= 0; blockIndex -= 1) {
            if (blocks[blockIndex].employeeId === employeeId) {
              blocks.splice(blockIndex, 1);
            }
          }
          return true;
        }
      }
    }
    return false;
  }

  function getChargeSummaryBlocks(chargeId: string): TimelineSummaryBlock[] {
    const charge = findChargeById(chargeId);
    if (!charge) {
      return [];
    }
    const employeeIds = new Set(charge.employees.map((employee) => employee.id));
    return blocks
      .filter((block) => employeeIds.has(block.employeeId))
      .map((block) => ({
        id: `summary-${chargeId}-${block.id}`,
        startKey: block.startKey,
        endKey: block.endKey,
      }));
  }

  function getBlock(employeeId: string, blockId: string): TimelineBlock | null {
    return blocks.find((block) => block.employeeId === employeeId && block.id === blockId) ?? null;
  }

  function hasBlockOverlap(employeeId: string, startKey: string, endKey: string, excludeBlockId?: string): boolean {
    return blocks.some((block) => {
      if (block.employeeId !== employeeId || block.id === excludeBlockId) {
        return false;
      }
      return rangesIntersect(startKey, endKey, block.startKey, block.endKey);
    });
  }

  function findChargeById(chargeId: string): Charge | null {
    for (const project of projects) {
      const charge = project.charges.find((candidate) => candidate.id === chargeId);
      if (charge) {
        return charge;
      }
    }
    return null;
  }

  function resolveEmployeeInCharge(chargeId: string, employeeName: string): { employee: Employee; created: boolean } | null {
    const charge = findChargeById(chargeId);
    if (!charge) {
      return null;
    }

    const normalizedName = normalizeName(employeeName);
    const existing = charge.employees.find((employee) => normalizeName(employee.name) === normalizedName);
    if (existing) {
      return { employee: existing, created: false };
    }

    const employee = addEmployee(chargeId, employeeName);
    return employee ? { employee, created: true } : null;
  }

  function getAllEmployees(): Employee[] {
    return projects.flatMap((project) => project.charges.flatMap((charge) => charge.employees));
  }

  function isProjectId(rowId: string): boolean {
    return projects.some((project) => project.id === rowId);
  }

  return {
    projects,
    getAllEmployees,
    getVisibleRows,
    getVisibleRowsForProjects,
    toggleGroup,
    isCollapsed,
    getEmployeeBlocks,
    getChargeSummaryBlocks,
    addEmployee,
    deleteEmployee,
    addBlock,
    updateBlock,
    deleteBlock,
    getBlock,
    hasBlockOverlap,
    findChargeById,
    resolveEmployeeInCharge,
  };
}

function toggleSet(set: Set<string>, value: string) {
  if (set.has(value)) {
    set.delete(value);
    return;
  }
  set.add(value);
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase('ru-RU');
}
