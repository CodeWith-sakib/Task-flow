import { TwoPhaseCommitCoordinator, Participant } from '../../src/storage/TwoPhaseCommitCoordinator';

describe('TwoPhaseCommitCoordinator', () => {
  it('should commit all participants when all vote yes', async () => {
    const coordinator = new TwoPhaseCommitCoordinator();
    const p1: Participant = {
      id: 'p1',
      prepare: jest.fn().mockResolvedValue(true),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined)
    };
    const p2: Participant = {
      id: 'p2',
      prepare: jest.fn().mockResolvedValue(true),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined)
    };

    const success = await coordinator.executeTransaction('tx-1', [p1, p2]);
    expect(success).toBe(true);
    expect(p1.commit).toHaveBeenCalledWith('tx-1');
    expect(p2.commit).toHaveBeenCalledWith('tx-1');
  });

  it('should rollback prepared participants if any participant fails', async () => {
    const coordinator = new TwoPhaseCommitCoordinator();
    const p1: Participant = {
      id: 'p1',
      prepare: jest.fn().mockResolvedValue(true),
      commit: jest.fn(),
      rollback: jest.fn().mockResolvedValue(undefined)
    };
    const p2: Participant = {
      id: 'p2',
      prepare: jest.fn().mockResolvedValue(false),
      commit: jest.fn(),
      rollback: jest.fn()
    };

    const success = await coordinator.executeTransaction('tx-2', [p1, p2]);
    expect(success).toBe(false);
    expect(p1.rollback).toHaveBeenCalledWith('tx-2');
    expect(p1.commit).not.toHaveBeenCalled();
  });
});
