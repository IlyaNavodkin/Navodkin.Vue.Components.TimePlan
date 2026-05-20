import type { Project, TimelineBlock } from '../types';

const projectNames = [
  'Orion',
  'Atlas',
  'Nova',
  'Vector',
  'Pulse',
  'Northwind',
  'Beacon',
  'Helix',
  'Vertex',
  'Signal',
  'Cobalt',
  'Delta',
  'Quartz',
  'Summit',
  'Nimbus',
  'Falcon',
  'Matrix',
  'Harbor',
  'Zenith',
  'Orbit',
];

const chargeNames = ['Design', 'Backend', 'Frontend', 'QA', 'Mobile', 'Infrastructure'];
const employeeNames = [
  'Анна К.',
  'Дмитрий Л.',
  'Игорь П.',
  'Макс С.',
  'Ольга В.',
  'Сергей Т.',
  'Елена М.',
  'Никита Р.',
  'Мария Б.',
  'Павел Д.',
];

export const sampleProjects: Project[] = projectNames.map((projectName, projectIndex) => {
  const chargeCount = projectIndex % 3 === 0 ? 3 : 2;
  const charges = Array.from({ length: chargeCount }, (_, chargeOffset) => {
    const chargeName = chargeNames[(projectIndex + chargeOffset) % chargeNames.length];
    const employeeCount = chargeOffset % 2 === 0 ? 2 : 3;
    const employees = Array.from({ length: employeeCount }, (_, employeeOffset) => {
      const employeeName = employeeNames[(projectIndex + chargeOffset + employeeOffset) % employeeNames.length];
      return {
        id: `project-${projectIndex + 1}-charge-${chargeOffset + 1}-employee-${employeeOffset + 1}`,
        name: employeeName,
      };
    });

    return {
      id: `project-${projectIndex + 1}-charge-${chargeOffset + 1}`,
      name: `Чардж: ${chargeName}`,
      employees,
    };
  });

  return {
    id: `project-${projectIndex + 1}`,
    name: `Проект ${projectName}`,
    charges,
  };
});

export function createSampleBlocks(todayKey: string, shiftDateKey: (key: string, days: number) => string): TimelineBlock[] {
  return sampleProjects.flatMap((project, projectIndex) => {
    return project.charges.flatMap((charge, chargeIndex) => {
      const firstEmployee = charge.employees[0];
      if (!firstEmployee || (projectIndex + chargeIndex) % 2 !== 0) {
        return [];
      }

      const startOffset = -20 + ((projectIndex * 7 + chargeIndex * 5) % 80);
      return [
        {
          id: `block-${projectIndex + 1}-${chargeIndex + 1}`,
          employeeId: firstEmployee.id,
          title: `${charge.name.replace('Чардж: ', '')} work`,
          startKey: shiftDateKey(todayKey, startOffset),
          endKey: shiftDateKey(todayKey, startOffset + 5 + (projectIndex % 4)),
        },
      ];
    });
  });
}
