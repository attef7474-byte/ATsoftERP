import { PartialType } from '@nestjs/mapped-types'
import { CreateInventoryLockDto } from './create-lock.dto'

export class UpdateInventoryLockDto extends PartialType(CreateInventoryLockDto) {}
