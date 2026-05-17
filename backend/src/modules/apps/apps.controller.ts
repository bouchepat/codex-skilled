import { Controller, Get, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { AppsService } from './apps.service';

@Controller('apps')
@UseGuards(FirebaseAuthGuard)
export class AppsController {
  constructor(private readonly apps: AppsService) {}

  @Get()
  list() {
    return this.apps.list();
  }
}

