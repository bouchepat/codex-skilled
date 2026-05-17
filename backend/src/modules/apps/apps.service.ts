import { Injectable } from '@nestjs/common';
import { AppDefinition, AppStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MARKET_RESEARCH_POLICY, AppSeedDefinition } from './app-policy';

const SEED_APPS = [
  {
    id: 'market-research',
    name: 'Market Research',
    description: 'Research markets, competitors, positioning, and report-ready insights.',
    status: AppStatus.ENABLED,
    policy: MARKET_RESEARCH_POLICY as unknown as Prisma.InputJsonValue
  },
  {
    id: 'image-processing',
    name: 'Image Processing',
    description: 'Upload, transform, optimize, and generate image assets.',
    status: AppStatus.COMING_SOON,
    policy: {
      allowedProviders: [],
      requiredSkills: [],
      requiredArtifacts: [],
      resumeSessions: false
    } as Prisma.InputJsonValue
  },
  {
    id: 'video-processing',
    name: 'Video Processing',
    description: 'Upload, transcode, trim, summarize, and generate video assets.',
    status: AppStatus.COMING_SOON,
    policy: {
      allowedProviders: [],
      requiredSkills: [],
      requiredArtifacts: [],
      resumeSessions: false
    } as Prisma.InputJsonValue
  }
] satisfies AppSeedDefinition[];

@Injectable()
export class AppsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<AppDefinition[]> {
    await Promise.all(
      SEED_APPS.map((app) =>
        this.prisma.appDefinition.upsert({
          where: { id: app.id },
          create: app,
          update: app
        })
      )
    );
    return this.prisma.appDefinition.findMany({ orderBy: { name: 'asc' } });
  }
}
