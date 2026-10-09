import { describe, expect, it } from 'vitest';
import { emptyProject, fromFormat, TEMPLATES, type Project } from './format/model';
import { exportFiles, projectProblemCount } from './exportFiles';

const base = TEMPLATES[0].build();
const project: Project = { guis: [base, { ...base, id: 'second' }] };

describe('exportFiles', () => {
  it('writes one file per GUI, named after its id', () => {
    const files = exportFiles(project);
    expect(files.map((f) => f.name)).toEqual([`${project.guis[0].id}.json`, 'second.json']);
  });

  it('writes format-v1 JSON that reads back into the same GUI', () => {
    const [first] = exportFiles(project);
    const back = fromFormat(JSON.parse(first.text));
    expect(back.id).toBe(project.guis[0].id);
    expect(back.items.map((i) => i.key)).toEqual(project.guis[0].items.map((i) => i.key));
  });

  it('counts problems across all GUIs', () => {
    expect(projectProblemCount(emptyProject())).toBe(0);
    const broken = { guis: [{ ...project.guis[0], id: '' }] };
    expect(projectProblemCount(broken)).toBeGreaterThan(0);
  });
});
