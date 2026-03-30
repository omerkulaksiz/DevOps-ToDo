package com.devops.todo.service;

import com.devops.todo.dto.TaskDTO;
import com.devops.todo.entity.Task;
import com.devops.todo.entity.TaskType;
import com.devops.todo.exception.TaskNotFoundException;
import com.devops.todo.repository.TaskRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class TaskService {

    private final TaskRepository taskRepository;

    public TaskService(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    public List<TaskDTO> getAllTasks() {
        return taskRepository.findAll()
                .stream()
                .map(this::convertToDTO)
                .toList();
    }

    public TaskDTO saveTask(TaskDTO taskDTO) {
        validateTask(taskDTO);

        Task task = convertToEntity(taskDTO);
        Task savedTask = taskRepository.save(task);

        return convertToDTO(savedTask);
    }

    public void deleteTask(Long id) {
        if (!taskRepository.existsById(id)) {
            throw new TaskNotFoundException(id);
        }
        taskRepository.deleteById(id);
    }

    public TaskDTO updateTask(Long id, TaskDTO updatedTaskDTO) {
        validateTask(updatedTaskDTO);

        Task task = taskRepository.findById(id)
                .orElseThrow(() -> new TaskNotFoundException(id));

        task.setTitle(updatedTaskDTO.getTitle());
        task.setDescription(updatedTaskDTO.getDescription());
        task.setType(updatedTaskDTO.getType());
        task.setDueDate(updatedTaskDTO.getDueDate());
        task.setCompleted(updatedTaskDTO.isCompleted());

        Task savedTask = taskRepository.save(task);
        return convertToDTO(savedTask);
    }

    public TaskDTO toggleComplete(Long id) {
        Task task = taskRepository.findById(id)
                .orElseThrow(() -> new TaskNotFoundException(id));

        task.setCompleted(!task.isCompleted());

        Task savedTask = taskRepository.save(task);
        return convertToDTO(savedTask);
    }

    private void validateTask(TaskDTO taskDTO) {
        if (taskDTO.getType() == TaskType.STRATEGISCH && taskDTO.getDueDate() == null) {
            throw new IllegalArgumentException("Für strategische Planung ist ein Zieldatum erforderlich.");
        }

        if (taskDTO.getType() != TaskType.STRATEGISCH) {
            taskDTO.setDueDate(null);
        }
    }

    private TaskDTO convertToDTO(Task task) {
        return new TaskDTO(
                task.getId(),
                task.getTitle(),
                task.getDescription(),
                task.getType(),
                task.getDueDate(),
                task.isCompleted()
        );
    }

    private Task convertToEntity(TaskDTO taskDTO) {
        Task task = new Task();
        task.setId(taskDTO.getId());
        task.setTitle(taskDTO.getTitle());
        task.setDescription(taskDTO.getDescription());
        task.setType(taskDTO.getType());
        task.setDueDate(taskDTO.getDueDate());
        task.setCompleted(taskDTO.isCompleted());
        return task;
    }
}

