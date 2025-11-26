import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddOnlineStatusToTutors1735000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'tutors',
      new TableColumn({
        name: 'activity_status',
        type: 'enum',
        enum: ['online', 'offline'],
        default: "'offline'",
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('tutors', 'activity_status');
  }
}

