import { ListChecks } from 'lucide-react'
import { type JSX } from 'react'
import { useWorkspace, type WorkspaceTask } from '../../state/workspace'

/**
 * The Tasks view: every checkbox item from the whole library, open items
 * first. The whole row opens the note the task lives in.
 */
export default function TasksList(): JSX.Element {
    const { tasks, toggleTask, revealBlock } = useWorkspace()

    const open = tasks.filter((entry) => !entry.task.checked)
    const done = tasks.filter((entry) => entry.task.checked)
    if (tasks.length === 0) return <TasksEmpty />
    const doneLabel = `notes-section-label${open.length > 0 ? ' notes-section-label--gap' : ''}`

    const row = (entry: WorkspaceTask): JSX.Element => {
        const { task, note } = entry
        const openTaskNote = (): void => void revealBlock(note.id, task.blockId)

        return (
            <div
                className="task-row"
                data-done={task.checked ? 'true' : 'false'}
                key={`${note.id}:${task.blockId}`}
                role="button"
                tabIndex={0}
                aria-label={`Open note ${noteTitle(note)}`}
                title={noteTitle(note)}
                onClick={openTaskNote}
                onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    openTaskNote()
                }}
            >
                <button
                    type="button"
                    className="task-check"
                    aria-label={
                        task.checked
                            ? `Mark “${task.text}” as not done`
                            : `Mark “${task.text}” as done`
                    }
                    aria-pressed={task.checked}
                    title={task.checked ? 'Mark as not done' : 'Mark as done'}
                    onClick={(event) => {
                        event.stopPropagation()
                        void toggleTask(note.id, task.blockId, !task.checked)
                    }}
                />
                <span className="task-text">{task.text || 'Untitled task'}</span>
            </div>
        )
    }

    return (
        <div className="tasks-list" aria-label="Tasks">
            {open.map(row)}
            {done.length > 0 && (
                <p className={doneLabel} role="presentation">
                    Done
                </p>
            )}
            {done.length > 0 && done.map(row)}
        </div>
    )
}

function noteTitle(note: WorkspaceTask['note']): string {
    return note.title.trim() || 'Untitled note'
}

function TasksEmpty(): JSX.Element {
    return (
        <div className="list-empty" role="status">
            <ListChecks className="list-empty-icon" size={22} aria-hidden="true" />
            <h2>No checkboxes yet</h2>
            <p>
                Make a check list inside any note and its items collect here, ready to tick. Done
                items stay with their note.
            </p>
        </div>
    )
}
