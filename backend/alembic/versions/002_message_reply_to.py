from alembic import op
import sqlalchemy as sa

revision = "002_message_reply_to"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("messages", sa.Column("reply_to_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_messages_reply_to_id",
        "messages",
        "messages",
        ["reply_to_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_messages_reply_to_id", "messages", ["reply_to_id"])


def downgrade() -> None:
    op.drop_index("ix_messages_reply_to_id", table_name="messages")
    op.drop_constraint("fk_messages_reply_to_id", "messages", type_="foreignkey")
    op.drop_column("messages", "reply_to_id")
