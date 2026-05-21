import { CronParser } from '../../src/scheduler/cron/CronParser';
import { DAGValidator } from '../../src/workflows/dag/DAGValidator';
import { WorkflowDefinition, WorkflowStep } from '../../src/workflows/types';

describe('Property-Based & Fuzzing Validation', () => {
  describe('CronParser fuzzing with randomized inputs', () => {
    // Seeded linear congruential generator for reproducible pseudo-random numbers
    let seed = 42;
    function pseudoRandom() {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    }

    it('should never throw uncaught panic or infinite loop on arbitrary string tokens', () => {
      const tokens = ['*', '?', '0', '15', '59', '60', '-1', '*/5', '1-5', 'a', '100', '1,2,3', 'foo', ''];

      for (let i = 0; i < 200; i++) {
        const f1 = tokens[Math.floor(pseudoRandom() * tokens.length)];
        const f2 = tokens[Math.floor(pseudoRandom() * tokens.length)];
        const f3 = tokens[Math.floor(pseudoRandom() * tokens.length)];
        const f4 = tokens[Math.floor(pseudoRandom() * tokens.length)];
        const f5 = tokens[Math.floor(pseudoRandom() * tokens.length)];

        const cronExpr = `${f1} ${f2} ${f3} ${f4} ${f5}`;
        const isValid = CronParser.validate(cronExpr);
        expect(typeof isValid).toBe('boolean');

        if (isValid) {
          // If validator deemed it valid, getNextRun should return a valid Date without throwing
          const baseDate = new Date(Date.UTC(2026, 0, 1, 12, 0, 0));
          const next = CronParser.getNextRun(cronExpr, baseDate);
          expect(next).toBeInstanceOf(Date);
          expect(next.getTime()).toBeGreaterThan(baseDate.getTime());
        }
      }
    });

    it('should produce monotonically increasing future run times for valid cron expressions', () => {
      const standardExpressions = [
        '*/15 * * * *',
        '0 0 * * *',
        '30 4 1 * *',
        '0 9-17 * * 1-5',
        '0,30 * * * *',
      ];

      for (const expr of standardExpressions) {
        let current = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));
        for (let step = 0; step < 5; step++) {
          const next = CronParser.getNextRun(expr, current);
          expect(next.getTime()).toBeGreaterThan(current.getTime());
          current = next;
        }
      }
    });
  });

  describe('DAGValidator property fuzzing with generated graphs', () => {
    it('should always correctly validate linear pipelines of arbitrary length', () => {
      for (let chainLen = 1; chainLen <= 25; chainLen++) {
        const steps: WorkflowStep[] = [];
        for (let i = 0; i < chainLen; i++) {
          steps.push({
            id: `node-${i}`,
            taskType: 'noop',
            dependsOn: i === 0 ? [] : [`node-${i - 1}`],
          });
        }

        const workflow: WorkflowDefinition = {
          id: `linear-chain-${chainLen}`,
          name: `Chain ${chainLen}`,
          version: 1,
          steps,
        };

        const result = DAGValidator.validate(workflow);
        expect(result.valid).toBe(true);
        expect(result.topologicalOrder.length).toBe(chainLen);
        expect(result.executionTiers.length).toBe(chainLen);
      }
    });

    it('should always group independent sibling tasks into the same execution tier', () => {
      const width = 10;
      const steps: WorkflowStep[] = [
        { id: 'root', taskType: 'prep', dependsOn: [] },
      ];

      for (let i = 0; i < width; i++) {
        steps.push({
          id: `worker-${i}`,
          taskType: 'work',
          dependsOn: ['root'],
        });
      }

      steps.push({
        id: 'collector',
        taskType: 'aggregate',
        dependsOn: steps.filter(s => s.id.startsWith('worker-')).map(s => s.id),
      });

      const workflow: WorkflowDefinition = {
        id: 'fanout-fanin',
        name: 'Diamond Fanout',
        version: 1,
        steps,
      };

      const result = DAGValidator.validate(workflow);
      expect(result.valid).toBe(true);
      expect(result.executionTiers.length).toBe(3);
      expect(result.executionTiers[0]).toEqual(['root']);
      expect(result.executionTiers[1].length).toBe(width);
      expect(result.executionTiers[2]).toEqual(['collector']);
    });
  });
});
