import { Body, Controller, Get, Param, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { WriteFileDto } from './dto/write-file.dto';
import { WorkspacesService } from './workspaces.service';

@Controller('workspaces')
@UseGuards(FirebaseAuthGuard)
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.workspaces.listForUser(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateWorkspaceDto) {
    return this.workspaces.create(user.id, dto.appId, dto.name);
  }

  @Get(':workspaceId/files')
  listFiles(@CurrentUser() user: AuthenticatedUser, @Param('workspaceId') workspaceId: string) {
    return this.workspaces.listFiles(user.id, workspaceId);
  }

  @Post(':workspaceId/files')
  writeFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: WriteFileDto
  ) {
    return this.workspaces.writeTextFile(user.id, workspaceId, dto.path, dto.content);
  }

  @Get(':workspaceId/files/read')
  readFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Query('path') filePath: string
  ) {
    return this.workspaces.readTextFile(user.id, workspaceId, filePath);
  }

  @Post(':workspaceId/files/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Query('path') filePath: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    return this.workspaces.saveUpload(user.id, workspaceId, filePath, file);
  }

  @Get(':workspaceId/files/download')
  async downloadFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Query('path') filePath: string,
    @Res() response: Response
  ) {
    const download = await this.workspaces.getDownload(user.id, workspaceId, filePath);
    response.type(download.file.mimeType ?? 'application/octet-stream');
    return response.download(download.absolutePath);
  }
}
