import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Создание обращения. authorId НЕ принимается от клиента — ставится из токена. */
export class CreateAppealDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  direction!: string;

  @IsString() @IsNotEmpty() @MaxLength(300)
  subject!: string;

  @IsString() @IsNotEmpty() @MaxLength(10000)
  text!: string;

  @IsOptional() @IsBoolean()
  isAnonymous?: boolean;
}

/** Комментарий к обращению. authorId НЕ принимается от клиента — ставится из токена. */
export class CreateCommentDto {
  @IsString() @IsNotEmpty() @MaxLength(10000)
  text!: string;
}
