package com.devops.todo.service;

import com.devops.todo.entities.Task;
import com.devops.todo.entities.TaskType;
import com.devops.todo.repository.TaskRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class TaskService {
    private final TaskRepository taskRepository;

    public TaskService(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    public List<Task> getAllTasks() {
        return taskRepository.findAll();
    }

    public Task saveTask(Task task) {
        if (task.getType() == TaskType.STRATEGISCH) {
            if (task.getDueDate() == null) {
                throw new IllegalArgumentException("Für strategische Planung ist ein Zieldatum erforderlich.");
            }
        } else {
            task.setDueDate(null);
        }

        return taskRepository.save(task);
    }

    public void deleteTask(Long id) {
        taskRepository.deleteById(id);
    }

    // Task aktualisieren
    public Task updateTask(Long id, Task updatedTask) {

        Task task = taskRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Task not found"));

        task.setTitle(updatedTask.getTitle());
        task.setDescription(updatedTask.getDescription());
        task.setType(updatedTask.getType());
        task.setDueDate(updatedTask.getDueDate());
        task.setCompleted(updatedTask.isCompleted());

        return taskRepository.save(task);
    }

    // Task als erledigt markieren
    public Task toggleComplete(Long id) {

        Task task = taskRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Task not found"));

        task.setCompleted(!task.isCompleted());

        return taskRepository.save(task);
    }
}

