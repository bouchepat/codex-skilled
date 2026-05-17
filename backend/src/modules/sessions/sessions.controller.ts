import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { CreateSessionDto } from './dto/create-session.dto';
import { SessionsService } from './sessions.service';

@Controller('sessions')
@UseGuards(FirebaseAuthGuard)
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.sessions.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSessionDto) {
    return this.sessions.create(user.id, dto.appId, dto.workspaceId, dto.title);
  }

  @Get(':sessionId')
  get(@CurrentUser() user: AuthenticatedUser, @Param('sessionId') sessionId: string) {
    return this.sessions.getOwnedSession(user.id, sessionId);
  }
}

