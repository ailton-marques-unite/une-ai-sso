import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserService } from '../../application/services/user-service/user.service';
import { RbacService } from '../../application/services/rbac-service/rbac.service';
import { UserResponseDto } from '../../application/dtos/user-response.dto';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly rbacService: RbacService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Retrieve information from authenticated users with roles' })
  @ApiResponse({
    status: 200,
    description: 'User information with roles and permissions',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMe(@Request() req: any): Promise<UserResponseDto & { roles: string[]; permissions: string[] }> {
    const domainId = req.domainContext?.domainId;
    const userId = req.user?.sub;

    if (!domainId || !userId) {
      throw new Error('Domain context and user are required');
    }

    const user = await this.userService.findById(domainId, userId);
    const { roles, permissions } = await this.rbacService.getUserRolesAndPermissions(
      domainId,
      userId,
    );

    return {
      ...user,
      roles,
      permissions,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve user data by ID (domain-scoped)' })
  @ApiResponse({
    status: 200,
    description: 'User data',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findById(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<UserResponseDto> {
    const domainId = req.domainContext?.domainId;
    if (!domainId) {
      throw new Error('Domain context is required');
    }
    return this.userService.findById(domainId, id);
  }
}
