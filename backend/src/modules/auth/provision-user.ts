import { PrismaService } from '../prisma/prisma.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

export interface DecodedFirebaseProfile {
  uid: string;
  email: string;
  name?: string;
  picture?: string;
}

export async function provisionFirebaseUser(prisma: PrismaService, decoded: DecodedFirebaseProfile) {
  try {
    return await prisma.user.upsert({
      where: { firebaseUid: decoded.uid },
      create: {
        firebaseUid: decoded.uid,
        email: decoded.email,
        displayName: decoded.name,
        photoUrl: decoded.picture
      },
      update: {
        email: decoded.email,
        displayName: decoded.name,
        photoUrl: decoded.picture
      }
    });
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
      return prisma.user.findUniqueOrThrow({ where: { firebaseUid: decoded.uid } });
    }
    throw error;
  }
}
