import { RecoveryJournal } from '../../src/storage/RecoveryJournal';

describe('RecoveryJournal', () => {
  it('should append operations and truncate after checkpoints', () => {
    const journal = new RecoveryJournal();
    journal.append('1', 'INSERT', { key: 'a' });
    journal.append('2', 'UPDATE', { key: 'a', val: 2 });

    expect(journal.size()).toBe(2);
    const uncheckpointed = journal.getUncheckpointedEntries(0);
    expect(uncheckpointed.length).toBe(2);

    journal.truncateBefore(Date.now() + 1000);
    expect(journal.size()).toBe(0);
  });
});
