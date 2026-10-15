/** Administrator-only cleanup of a named, synthetic local acceptance fixture. No HTTP reset endpoint. */
export async function cleanupFixture(pool, room) {
  const client = await pool.connect();
  try {
    const scope = (
      await client.query(
        "SELECT c.id FROM classroom c JOIN app_user u ON u.id=c.created_by WHERE c.id=$1 AND c.name LIKE 'Synthetic %' AND (u.email_lookup LIKE 'v20-%@example.test' OR u.email_lookup LIKE 'day4-%@example.test')",
        [room],
      )
    ).rows;
    if (!scope.length)
      throw Error("Refusing cleanup outside the named acceptance namespace");
    await client.query("BEGIN");
    for (const t of [
      "scheduled_score_run",
      "appeal",
      "score_override",
      "evaluation_draft_answer",
      "evaluation_draft",
      "group_artifact",
      "individual_artifact",
    ])
      await client.query(
        `DELETE FROM ${t} WHERE assignment_id IN(SELECT id FROM assignment WHERE classroom_id=$1)`,
        [room],
      );
    await client.query(
      "DELETE FROM score_snapshot_item WHERE score_snapshot_id IN(SELECT id FROM score_snapshot WHERE assignment_id IN(SELECT id FROM assignment WHERE classroom_id=$1))",
      [room],
    );
    await client.query(
      "DELETE FROM score_snapshot WHERE assignment_id IN(SELECT id FROM assignment WHERE classroom_id=$1)",
      [room],
    );
    await client.query(
      "DELETE FROM submission_answer WHERE revision_id IN(SELECT id FROM submission_revision WHERE assignment_id IN(SELECT id FROM assignment WHERE classroom_id=$1))",
      [room],
    );
    await client.query(
      "DELETE FROM submission_revision WHERE assignment_id IN(SELECT id FROM assignment WHERE classroom_id=$1)",
      [room],
    );
    await client.query(
      "DELETE FROM comparison_review_decision WHERE pair_assignment_id IN(SELECT id FROM pair_assignment WHERE assignment_id IN(SELECT id FROM assignment WHERE classroom_id=$1))",
      [room],
    );
    await client.query(
      "DELETE FROM pair_assignment WHERE assignment_id IN(SELECT id FROM assignment WHERE classroom_id=$1)",
      [room],
    );
    for (const t of ["assignment_generation", "criterion"])
      await client.query(
        `DELETE FROM ${t} WHERE assignment_id IN(SELECT id FROM assignment WHERE classroom_id=$1)`,
        [room],
      );
    await client.query("DELETE FROM assignment WHERE classroom_id=$1", [room]);
    for (const t of [
      "classroom_member",
      "group_entity",
      "synthetic_close_friend",
      "synthetic_quality_cohort",
    ])
      await client.query(`DELETE FROM ${t} WHERE classroom_id=$1`, [room]);
    await client.query("DELETE FROM classroom WHERE id=$1", [room]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
