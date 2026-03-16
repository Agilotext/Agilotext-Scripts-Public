import os
from datetime import datetime


class AnonUtil:

    @staticmethod
    def display_with_time(display):
        current_time = datetime.now()
        print(str(current_time), display);

    @staticmethod
    def check_file_exists(file_path):
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"The file {file_path} does not exist.")

    @staticmethod
    def get_anon_filename(in_file_path):
        # Split the file path into the path and extension
        in_file_path_root, in_file_path_extension = os.path.splitext(in_file_path)

        out_file_path = in_file_path_root + "_anon" + in_file_path_extension
        return out_file_path
