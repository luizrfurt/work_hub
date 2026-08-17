from alembic import op
import sqlalchemy as sa

revision = "003_message_updated_at"
down_revision = "002_task_attachments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "messages",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.execute(sa.text("UPDATE messages SET updated_at = created_at"))


def downgrade() -> None:
    op.drop_column("messages", "updated_at")
