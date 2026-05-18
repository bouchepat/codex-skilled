import { Queue } from 'bullmq';
import { JobsService } from './jobs.service';

describe('JobsService', () => {
  it('lists jobs for a workspace without scanning unrelated sessions', async () => {
    const prisma = {
      session: {
        findMany: jest.fn().mockResolvedValue([{ id: 'session-1' }, { id: 'session-2' }])
      },
      agentJob: {
        findMany: jest.fn().mockResolvedValue([{ id: 'job-1' }])
      }
    } as any;
    const sessions = {} as any;
    const queue = { add: jest.fn() } as unknown as Queue;
    const service = new JobsService(prisma, sessions, queue);

    const jobs = await service.list('user-1', 'workspace-1');

    expect(prisma.session.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', workspaceId: 'workspace-1' },
      select: { id: true }
    });
    expect(prisma.agentJob.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', sessionId: { in: ['session-1', 'session-2'] } },
      select: {
        id: true,
        userId: true,
        sessionId: true,
        iterationId: true,
        provider: true,
        status: true,
        prompt: true,
        error: true,
        createdAt: true,
        startedAt: true,
        finishedAt: true,
        artifacts: { include: { file: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    });
    expect(jobs).toEqual([{ id: 'job-1', logs: [] }]);
  });
});
