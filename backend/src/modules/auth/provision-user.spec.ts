import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { provisionFirebaseUser } from './provision-user';

describe('provisionFirebaseUser', () => {
  it('returns the existing user when concurrent provisioning creates the same firebase uid', async () => {
    const existingUser = {
      id: 'user-1',
      firebaseUid: 'firebase-1',
      email: 'person@example.com',
      displayName: 'Person',
      photoUrl: null
    };
    const prisma = {
      user: {
        upsert: jest.fn().mockRejectedValue(
          new PrismaClientKnownRequestError('Unique constraint failed', {
            code: 'P2002',
            clientVersion: 'test'
          })
        ),
        findUniqueOrThrow: jest.fn().mockResolvedValue(existingUser)
      }
    };

    await expect(
      provisionFirebaseUser(prisma as never, {
        uid: 'firebase-1',
        email: 'person@example.com',
        name: 'Person'
      })
    ).resolves.toBe(existingUser);
  });
});

