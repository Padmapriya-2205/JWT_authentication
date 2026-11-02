import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'Username may contain letters, numbers, dots, underscores, and hyphens only.',
  })
  @MinLength(3)
  @MaxLength(30)
  username!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @IsString()
  @Matches(/^[+0-9() .-]{7,20}$/, {
    message: 'Enter a valid phone number.',
  })
  phoneNumber!: string;
}
