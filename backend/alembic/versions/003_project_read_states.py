from alembic import op
import sqlalchemy as sa

revision = "003_project_read_states"
down_revision = "002_message_reply_to"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "project_read_states",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column(
            "last_read_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("project_id", "user_id", name="uq_project_read_states_project_user"),
    )
    op.create_index("ix_project_read_states_project_id", "project_read_states", ["project_id"])
    op.create_index("ix_project_read_states_user_id", "project_read_states", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_project_read_states_user_id", table_name="project_read_states")
    op.drop_index("ix_project_read_states_project_id", table_name="project_read_states")
    op.drop_table("project_read_states")
