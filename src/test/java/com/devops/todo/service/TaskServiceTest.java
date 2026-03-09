package com.devops.todo.service;

import com.devops.todo.dto.TaskDTO;
import com.devops.todo.entity.Task;
import com.devops.todo.entity.TaskType;
import com.devops.todo.exception.TaskNotFoundException;
import com.devops.todo.repository.TaskRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TaskServiceTest {

    @Mock
    private TaskRepository taskRepository;

    @InjectMocks
    private TaskService taskService;

    @Test
    void getAllTasks_shouldReturnTaskDTOList() {
        Task task = new Task();
        task.setId(1L);
        task.setTitle("Test Task");
        task.setDescription("Beschreibung");
        task.setType(TaskType.STRATEGISCH);
        task.setDueDate(LocalDate.of(2026, 3, 15));
        task.setCompleted(false);

        when(taskRepository.findAll()).thenReturn(List.of(task));

        List<TaskDTO> result = taskService.getAllTasks();

        assertEquals(1, result.size());
        assertEquals("Test Task", result.get(0).getTitle());
        assertEquals(TaskType.STRATEGISCH, result.get(0).getType());
        verify(taskRepository, times(1)).findAll();
    }

    @Test
    void saveTask_shouldSaveAndReturnTaskDTO() {
        TaskDTO input = new TaskDTO(
                null,
                "Neue Task",
                "Erste Aufgabe",
                TaskType.STRATEGISCH,
                LocalDate.of(2026, 3, 15),
                false
        );

        Task savedTask = new Task();
        savedTask.setId(1L);
        savedTask.setTitle("Neue Task");
        savedTask.setDescription("Erste Aufgabe");
        savedTask.setType(TaskType.STRATEGISCH);
        savedTask.setDueDate(LocalDate.of(2026, 3, 15));
        savedTask.setCompleted(false);

        when(taskRepository.save(any(Task.class))).thenReturn(savedTask);

        TaskDTO result = taskService.saveTask(input);

        assertNotNull(result.getId());
        assertEquals(1L, result.getId());
        assertEquals("Neue Task", result.getTitle());
        verify(taskRepository, times(1)).save(any(Task.class));
    }

    @Test
    void saveTask_shouldThrowException_whenStrategischWithoutDueDate() {
        TaskDTO input = new TaskDTO(
                null,
                "Neue Task",
                "Ohne Datum",
                TaskType.STRATEGISCH,
                null,
                false
        );

        IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> taskService.saveTask(input)
        );

        assertEquals("Für strategische Planung ist ein Zieldatum erforderlich.", exception.getMessage());
        verify(taskRepository, never()).save(any(Task.class));
    }

    @Test
    void updateTask_shouldUpdateAndReturnTaskDTO() {
        Task existingTask = new Task();
        existingTask.setId(1L);
        existingTask.setTitle("Alt");
        existingTask.setDescription("Alt Beschreibung");
        existingTask.setType(TaskType.SOFORT);
        existingTask.setDueDate(null);
        existingTask.setCompleted(false);

        TaskDTO updateDTO = new TaskDTO(
                1L,
                "Neu",
                "Neu Beschreibung",
                TaskType.STRATEGISCH,
                LocalDate.of(2026, 3, 20),
                true
        );

        Task updatedTask = new Task();
        updatedTask.setId(1L);
        updatedTask.setTitle("Neu");
        updatedTask.setDescription("Neu Beschreibung");
        updatedTask.setType(TaskType.STRATEGISCH);
        updatedTask.setDueDate(LocalDate.of(2026, 3, 20));
        updatedTask.setCompleted(true);

        when(taskRepository.findById(1L)).thenReturn(Optional.of(existingTask));
        when(taskRepository.save(any(Task.class))).thenReturn(updatedTask);

        TaskDTO result = taskService.updateTask(1L, updateDTO);

        assertEquals("Neu", result.getTitle());
        assertEquals(true, result.isCompleted());
        assertEquals(TaskType.STRATEGISCH, result.getType());
        verify(taskRepository, times(1)).findById(1L);
        verify(taskRepository, times(1)).save(any(Task.class));
    }

    @Test
    void updateTask_shouldThrowException_whenTaskNotFound() {
        TaskDTO updateDTO = new TaskDTO(
                1L,
                "Neu",
                "Beschreibung",
                TaskType.STRATEGISCH,
                LocalDate.of(2026, 3, 20),
                false
        );

        when(taskRepository.findById(1L)).thenReturn(Optional.empty());

        assertThrows(TaskNotFoundException.class, () -> taskService.updateTask(1L, updateDTO));

        verify(taskRepository, times(1)).findById(1L);
        verify(taskRepository, never()).save(any(Task.class));
    }

    @Test
    void toggleComplete_shouldToggleCompletedStatus() {
        Task task = new Task();
        task.setId(1L);
        task.setTitle("Test");
        task.setDescription("Beschreibung");
        task.setType(TaskType.SOFORT);
        task.setCompleted(false);

        Task toggledTask = new Task();
        toggledTask.setId(1L);
        toggledTask.setTitle("Test");
        toggledTask.setDescription("Beschreibung");
        toggledTask.setType(TaskType.SOFORT);
        toggledTask.setCompleted(true);

        when(taskRepository.findById(1L)).thenReturn(Optional.of(task));
        when(taskRepository.save(any(Task.class))).thenReturn(toggledTask);

        TaskDTO result = taskService.toggleComplete(1L);

        assertTrue(result.isCompleted());
        verify(taskRepository, times(1)).findById(1L);
        verify(taskRepository, times(1)).save(any(Task.class));
    }

    @Test
    void deleteTask_shouldDeleteWhenTaskExists() {
        when(taskRepository.existsById(1L)).thenReturn(true);

        taskService.deleteTask(1L);

        verify(taskRepository, times(1)).existsById(1L);
        verify(taskRepository, times(1)).deleteById(1L);
    }

    @Test
    void deleteTask_shouldThrowException_whenTaskNotFound() {
        when(taskRepository.existsById(1L)).thenReturn(false);

        assertThrows(TaskNotFoundException.class, () -> taskService.deleteTask(1L));

        verify(taskRepository, times(1)).existsById(1L);
        verify(taskRepository, never()).deleteById(anyLong());
    }
}